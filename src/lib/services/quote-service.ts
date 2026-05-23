import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

export async function autoCreateProjectFromQuote(quoteId: string, tenantId: string) {
    try {
        // 1. Fetch the quote
        const quote = await prisma.globalPage.findUnique({
            where: { id: quoteId },
            include: { database: true }
        });

        if (!quote) return { success: false, error: 'Quote not found' };

        const props = quote.properties as Record<string, any>;
        
        // Avoid duplicates: check if project already linked
        if (props.project) {
            console.log(`[autoCreateProject] Quote ${quoteId} already has a project linked: ${props.project}`);
            return { success: true, projectId: props.project };
        }

        const clientIdRaw = props.client;
        const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
        const total = props.totalIncVat || props.totalExVat || 0;
        const title = props.betreft || props.title || 'New Project';

        // 2. Create GlobalPage in db-1 (Projects Management)
        // We use a fixed ID for db-1 or look it up via tenant's lockedDbIds
        let projectDbId = 'db-1';
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { lockedDbIds: true }
        });
        if (tenant?.lockedDbIds && typeof tenant.lockedDbIds === 'object') {
            const locked = tenant.lockedDbIds as Record<string, string>;
            if (locked['projects']) projectDbId = locked['projects'];
        }

        const projectId = uuidv4();
        
        // Get order for db-1
        const maxOrderRow = await prisma.globalPage.findFirst({
            where: { databaseId: projectDbId },
            orderBy: { order: 'desc' },
            select: { order: true }
        });
        const order = (maxOrderRow?.order ?? -1) + 1;

        await prisma.globalPage.create({
            data: {
                id: projectId,
                databaseId: projectDbId,
                order,
                properties: {
                    title: `[EXEC] ${title}`,
                    'prop-execution-status': 'opt-to-do',
                    'prop-financial-status': 'opt-quote',
                    'prop-client': clientId ? [clientId] : [],
                    'prop-budget': total,
                    'prop-quote-link': [quoteId],
                } as Prisma.InputJsonValue,
                blocks: quote.blocks || [], // Copy blocks as initial project scope
                createdBy: 'system',
                lastEditedBy: 'system',
            }
        });

        // 3. Create InternalProject (ERP/Scheduler shadow record)
        // This ensures it shows up in LinkedRecords and Scheduler
        const latestProject = await prisma.internalProject.findFirst({
            where: { tenantId },
            orderBy: { projectCode: 'desc' }
        });

        let nextNum = 1;
        if (latestProject && latestProject.projectCode.startsWith('PRJ-')) {
            const numPart = parseInt(latestProject.projectCode.split('-')[1], 10);
            if (!isNaN(numPart)) nextNum = numPart + 1;
        }
        const projectCode = `PRJ-${String(nextNum).padStart(3, '0')}`;

        await prisma.internalProject.create({
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
        await prisma.globalPage.update({
            where: { id: quoteId },
            data: {
                properties: {
                    ...props,
                    project: [projectId]
                }
            }
        });

        // 5. Create Tasks in db-tasks if available
        let tasksDbId = 'db-tasks';
        if (tenant?.lockedDbIds && typeof tenant.lockedDbIds === 'object') {
            const locked = tenant.lockedDbIds as Record<string, string>;
            if (locked['tasks']) tasksDbId = locked['tasks'];
        }

        const quoteBlocks = (quote.blocks || []) as any[];
        const extractAndCreateTasks = async (nodes: any[]) => {
            for (const block of nodes) {
                if (block.type === 'line' || block.type === 'post') {
                    await prisma.globalPage.create({
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
                if (block.children) await extractAndCreateTasks(block.children);
            }
        };
        await extractAndCreateTasks(quoteBlocks);

        return { success: true, projectId };
    } catch (error) {
        console.error('[autoCreateProjectFromQuote] Error:', error);
        return { success: false, error: String(error) };
    }
}
