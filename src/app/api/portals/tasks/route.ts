import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPortalAccess } from '@/lib/portal-auth';

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

        const task = await prisma.globalPage.create({
            data: {
                databaseId: 'db-tasks',
                createdBy: 'system:portal',
                lastEditedBy: 'system:portal',
                properties: {
                    'title': title,
                    'prop-task-status': 'opt-todo',
                    'prop-task-due': dueDate ? new Date(dueDate).toISOString() : '',
                    'prop-task-file-url': fileUrl || '',
                    'prop-task-portal': [authResult.portal.id],
                    'prop-task-priority': 'opt-p4',
                    'prop-task-tags': []
                }
            }
        });

        const mappedTask = {
            id: task.id,
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

        // Verify task exists and belongs to db-tasks
        const existing = await prisma.globalPage.findUnique({ where: { id } });
        if (!existing || existing.databaseId !== 'db-tasks') {
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

        const newProperties = {
            ...props,
        };

        if (title !== undefined) newProperties['title'] = title;
        if (status !== undefined) newProperties['prop-task-status'] = status === 'DONE' ? 'opt-done' : 'opt-todo';
        if (dueDate !== undefined) newProperties['prop-task-due'] = dueDate ? new Date(dueDate).toISOString() : '';
        if (fileUrl !== undefined) newProperties['prop-task-file-url'] = fileUrl || '';

        const task = await prisma.globalPage.update({
            where: { id },
            data: {
                properties: newProperties,
                lastEditedBy: 'system:portal'
            }
        });

        const mappedTask = {
            id: task.id,
            title: newProperties['title'],
            status: newProperties['prop-task-status'] === 'opt-done' ? 'DONE' : 'TODO',
            dueDate: dueDate || null,
            fileUrl: fileUrl || null
        };

        return NextResponse.json(mappedTask);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}
