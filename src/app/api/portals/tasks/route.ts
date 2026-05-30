import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { portalId, title, dueDate, fileUrl } = body;

        const task = await prisma.globalPage.create({
            data: {
                databaseId: 'db-tasks',
                createdBy: session?.user?.id || 'system',
                lastEditedBy: session?.user?.id || 'system',
                properties: {
                    'title': title,
                    'prop-task-status': 'opt-todo',
                    'prop-task-due': dueDate ? new Date(dueDate).toISOString() : '',
                    'prop-task-file-url': fileUrl || '',
                    'prop-task-portal': [portalId], // Array of portal IDs
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
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, title, status, dueDate, fileUrl } = body;

        // Verify task exists and we can access its portal
        const existing = await prisma.globalPage.findUnique({ where: { id } });
        if (!existing || existing.databaseId !== 'db-tasks') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const props = (existing.properties as Record<string, any>) || {};
        const portalIds = props['prop-task-portal'] as string[] || [];
        if (!portalIds.length) {
             return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        
        // We verify the portal belongs to the tenant
        const portal = await prisma.clientPortal.findFirst({
            where: { id: { in: portalIds }, tenantId }
        });
        
        if (!portal) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const newProperties = {
            ...((existing.properties as Record<string, any>) || {}),
        };
        
        if (title !== undefined) newProperties['title'] = title;
        if (status !== undefined) newProperties['prop-task-status'] = status === 'DONE' ? 'opt-done' : 'opt-todo';
        if (dueDate !== undefined) newProperties['prop-task-due'] = dueDate ? new Date(dueDate).toISOString() : '';
        if (fileUrl !== undefined) newProperties['prop-task-file-url'] = fileUrl || '';

        const task = await prisma.globalPage.update({
            where: { id },
            data: { properties: newProperties }
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
