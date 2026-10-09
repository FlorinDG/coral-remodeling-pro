import { NextResponse } from 'next/server';
import { verifyPortalAccess } from '@/lib/portal-auth';
import { portalScope, platformDb } from '@/lib/data/scope';
import { systemDatabaseId } from '@/lib/data/system-databases';
import { saveRecord } from '@/lib/data/records';
import { buildPortalTaskCreateData, buildPortalTaskUpdateIntent } from '@/lib/records/portal-export-intents';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { portalId, title, dueDate, fileUrl } = body;

        if (!portalId) {
            return NextResponse.json({ error: 'Portal ID required' }, { status: 400 });
        }

        const authResult = await verifyPortalAccess(request, { portalId });
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
        }

        // R2-1-CENSUS #23: the PORTAL's tenant's tasks database — a hard-coded 'db-tasks' is BV Coral's, so every
        // other tenant's portal wrote its tasks there. Seraph: the binding is read by systemDatabaseId (fails
        // closed — no binding, no guess), the write goes through the portal scope (PT-5).
        let tasksDbId: string;
        try { tasksDbId = await systemDatabaseId(authResult.portal.tenantId, 'tasks'); }
        catch { return NextResponse.json({ error: 'unbound_system_database: tasks' }, { status: 409 }); }

        const pageId = crypto.randomUUID();
        const { intent, opts } = buildPortalTaskCreateData({
            pageId,
            databaseId: tasksDbId,
            portalId: authResult.portal.id,
            title,
            dueDate,
            fileUrl,
        });

        const client = portalScope(authResult);
        const res = await saveRecord(client, intent, opts);
        if (!res.ok) {
            return NextResponse.json({ error: `Failed to create task: ${res.refusal.code}` }, { status: 500 });
        }

        const mappedTask = {
            id: pageId,
            title: title,
            status: 'TODO',
            dueDate: dueDate || null,
            fileUrl: fileUrl || null
        };

        return NextResponse.json(mappedTask);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, title, status, dueDate, fileUrl } = body;

        if (!id) {
            return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
        }

        // Which portal(s) the task names is read before any tenant is known — the platform door (D4), read
        // only; the WRITE below goes through the granting portal's scope. (R2-1-CENSUS #23/#24)
        const existing = await platformDb().globalPage.findUnique({ where: { id }, include: { database: { select: { logicalKey: true, tenantId: true } } } });
        if (!existing || existing.database.logicalKey !== 'tasks') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const props = (existing.properties as Record<string, any>) || {};
        const portalIds = (props['prop-task-portal'] as string[]) || [];
        if (!portalIds.length) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Verify user has access to at least one of the linked portals
        let authorizedPortal = null;
        for (const pid of portalIds) {
            const authRes = await verifyPortalAccess(request, { portalId: pid });
            if (authRes.success) {
                authorizedPortal = authRes.portal;
                break;
            }
        }

        if (!authorizedPortal) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // …and the portal that grants access belongs to the same tenant as the task.
        if (authorizedPortal.tenantId !== existing.database.tenantId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const client = portalScope({ success: true, portal: authorizedPortal });
        const { intent, opts } = buildPortalTaskUpdateIntent({
            pageId: id,
            title,
            status,
            dueDate,
            fileUrl,
        });

        const res = await saveRecord(client, intent, opts);
        if (!res.ok) {
            return NextResponse.json({ error: `Failed to update task: ${res.refusal.code}` }, { status: 403 });
        }

        const finalTitle = title !== undefined ? title : props['title'];
        const finalStatus = (status !== undefined ? (status === 'DONE' ? 'opt-done' : 'opt-todo') : props['prop-task-status']) === 'opt-done' ? 'DONE' : 'TODO';
        const finalDue = dueDate !== undefined ? (dueDate || null) : (props['prop-task-due'] || null);
        const finalFile = fileUrl !== undefined ? (fileUrl || null) : (props['prop-task-file-url'] || null);

        const mappedTask = {
            id,
            title: finalTitle,
            status: finalStatus,
            dueDate: finalDue,
            fileUrl: finalFile,
        };

        return NextResponse.json(mappedTask);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}
