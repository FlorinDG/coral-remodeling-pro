import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { systemScope } from '@/lib/data/scope';
import { systemDatabaseId } from '@/lib/data/system-databases';

/**
 * Quote accepted → project (+ tasks). Through the seraph (R2-1-CENSUS #33–35, 2026-10-04): every read and
 * write on the tenant's system scope, the quote must be a QUOTATION of that tenant, and the projects / tasks
 * databases come from the binding (fails closed) — no 'db-1' / 'db-tasks' fallback, which are BV Coral's.
 * Callers: updatePageServerFirst (session tenant), acceptQuotation (the accepted document's tenant).
 */
export async function autoCreateProjectFromQuote(quoteId: string, tenantId: string) {
    try {
        const db = systemScope(tenantId, `quote ${quoteId} accepted → project`);
        // 1. Fetch the quote — a quotation of THIS tenant, or nothing
        const quote = await db.globalPage.findFirst({
            where: { id: quoteId, database: { logicalKey: 'quotations' } },
        });

        if (!quote) return { success: false, error: 'Quote not found' };

        const props = quote.properties as Record<string, unknown>;
        
        // Avoid duplicates: check if project already linked
        if (props.project) {
            console.log(`[autoCreateProject] Quote ${quoteId} already has a project linked: ${props.project}`);
            return { success: true, projectId: props.project as string };
        }

        const clientIdRaw = props.client;
        const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
        const total = (props.totalIncVat as number) || (props.totalExVat as number) || 0;
        const title = (props.betreft as string) || (props.title as string) || 'New Project';
        const billingRule = (props['prop-billing-rule'] as string) || 'opt-fixed';

        // 2. The tenant's projects database — from the binding; none → no project (never a guessed 'db-1')
        const projectDbId = await systemDatabaseId(tenantId, 'projects');

        const projectId = uuidv4();

        // Get order for db-1
        const maxOrderRow = await db.globalPage.findFirst({
            where: { databaseId: projectDbId },
            orderBy: { order: 'desc' },
            select: { order: true }
        });
        const order = (maxOrderRow?.order ?? -1) + 1;

        await db.globalPage.create({
            data: {
                id: projectId,
                databaseId: projectDbId,
                order,
                properties: {
                    title: `[EXEC] ${title}`,
                    location: props.location || null,
                    'prop-execution-status': 'opt-to-do',
                    'prop-financial-status': 'opt-quote',
                    'prop-client': clientId ? [clientId] : [],
                    'prop-budget': total,
                    'prop-quote-link': [quoteId],
                    'prop-billing-rule': billingRule,
                } as Prisma.InputJsonValue,
                blocks: quote.blocks || [], // Copy blocks as initial project scope
                createdBy: 'system',
                lastEditedBy: 'system',
            }
        });

        // 3. Create InternalProject (ERP/Scheduler shadow record)
        // This ensures it shows up in LinkedRecords and Scheduler
        const latestProject = await db.internalProject.findFirst({
            orderBy: { projectCode: 'desc' }
        });

        let nextNum = 1;
        if (latestProject && latestProject.projectCode.startsWith('PRJ-')) {
            const numPart = parseInt(latestProject.projectCode.split('-')[1], 10);
            if (!isNaN(numPart)) nextNum = numPart + 1;
        }
        const projectCode = `PRJ-${String(nextNum).padStart(3, '0')}`;

        await db.internalProject.create({
            data: {
                id: projectId, // Use same ID for consistency if possible, or link them
                tenantId,
                projectCode,
                name: title,
                clientId: clientId || null,
                budget: total,
                status: 'PLANNING',
            }
        });

        // 4. Update Quote to link back to Project
        await db.globalPage.update({
            where: { id: quoteId },
            data: {
                properties: {
                    ...props,
                    project: [projectId]
                },
                lastEditedBy: 'system:quote-service'
            }
        });

        // 5. Tasks in the tenant's tasks database, if it has one (binding; never a guessed 'db-tasks')
        let tasksDbId: string | null = null;
        try { tasksDbId = await systemDatabaseId(tenantId, 'tasks'); }
        catch { console.warn(`[autoCreateProject] tenant ${tenantId} has no tasks binding — no tasks created`); }

        const quoteBlocks = (quote.blocks || []) as unknown[];
        const extractAndCreateTasks = async (nodes: unknown[]) => {
            for (const item of nodes) {
                const block = item as Record<string, any>;
                if (tasksDbId && (block.type === 'line' || block.type === 'post')) {
                    await db.globalPage.create({
                        data: {
                            id: uuidv4(),
                            databaseId: tasksDbId,
                            properties: {
                                title: block.content || 'Task',
                                'prop-task-status': 't-todo',
                                'prop-task-project': [projectId]
                            } as Prisma.InputJsonValue,
                            createdBy: 'system',
                            lastEditedBy: 'system',
                        }
                    });
                }
                if (block.children) await extractAndCreateTasks(block.children as unknown[]);
            }
        };
        await extractAndCreateTasks(quoteBlocks);

        return { success: true, projectId };
    } catch (error) {
        console.error('[autoCreateProjectFromQuote] Error:', error);
        return { success: false, error: String(error) };
    }
}
