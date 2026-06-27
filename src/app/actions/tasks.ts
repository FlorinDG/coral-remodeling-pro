'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new task page in the tenant's db-tasks GlobalDatabase.
 * Safe to call from any server context — resolves the correct database ID
 * via lockedDbIds (tenant-scoped) or falls back to 'db-tasks'.
 *
 * Used by:
 *   - useTasks.createTask() (shift planning quick-create)
 *   - TaskQuickAdd (admin task module NLP bar)
 */
export async function createTaskPage(input: {
    title: string;
    status?: string;      // select option ID, e.g. 'opt-todo'
    priority?: string;    // select option ID, e.g. 'opt-high'
    projectId?: string;   // GlobalPage ID of the linked project (relation)
    assignee?: string;    // User ID (person property — single value stored as array)
    dueDate?: string;     // ISO date string, e.g. '2026-05-20'
    tags?: string[];      // multi_select option IDs
    section?: string;     // select option ID for section
    notes?: string;
}) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;
    if (!tenantId || !userId) throw new Error('Unauthorized');

    // Resolve the tenant's tasks database ID (may be a locked/scoped variant)
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true }
    });
    const locked = (tenant?.lockedDbIds as Record<string, string>) || {};
    const tasksDbId = locked['tasks'] || 'db-tasks';

    // Ensure the GlobalDatabase exists in Postgres for this tenant.
    // If it doesn't (first session before sync), we cannot create the page —
    // the store's syncDb must have run at least once first.
    const db = await prisma.globalDatabase.findFirst({
        where: { id: tasksDbId, tenantId },
        select: { id: true }
    });

    if (!db) {
        throw new Error(
            `Tasks database '${tasksDbId}' not found for tenant '${tenantId}'. ` +
            `Open the Tasks module in the admin panel first to initialize it.`
        );
    }

    // Get current page count for order assignment
    const pageCount = await prisma.globalPage.count({
        where: { databaseId: tasksDbId }
    });

    const pageId = uuidv4();
    const now = new Date().toISOString();

    const page = await prisma.globalPage.create({
        data: {
            id: pageId,
            databaseId: db.id,
            properties: {
                title:                  input.title,
                'prop-task-status':     input.status    || 'opt-todo',
                'prop-task-priority':   (() => {
                    const p = input.priority;
                    if (!p) return 'opt-p4';
                    const val = p.toLowerCase();
                    if (val.includes('p1') || val.includes('urgent')) return 'opt-p1';
                    if (val.includes('p2') || val.includes('high')) return 'opt-p2';
                    if (val.includes('p3') || val.includes('normal') || val.includes('med')) return 'opt-p3';
                    if (val.includes('p4') || val.includes('low')) return 'opt-p4';
                    return 'opt-p4';
                })(),
                'prop-task-project':    input.projectId ? [input.projectId] : [],
                'prop-task-assignee':   input.assignee  ? [input.assignee]  : [],
                'prop-task-due':        input.dueDate   || '',
                'prop-task-tags':       input.tags      || [],
                'prop-task-section':    input.section   || '',
                'prop-task-notes':      input.notes     || '',
                'prop-task-my-day':     false,
                'prop-task-flagged':    false,
                'prop-task-defer':      '',
                'prop-task-recurrence': '',
                'prop-task-estimated':  null,
                'prop-task-completed-at': '',
                'prop-task-reviewed-at':  '',
                'prop-task-depends-on':   [],
                'created':              now,
                'last_edited_time':     now,
            },
            blocks: [],
            order: pageCount,
            assignedTo: input.assignee ? [input.assignee] : [],
            createdBy: userId,
            lastEditedBy: userId,
        }
    });

    return {
        id: page.id,
        title: input.title,
        databaseId: tasksDbId,
    };
}

/**
 * Updates the status of a task page in db-tasks.
 * Called by management to mark a task as officially done.
 * Workforce completion of a ShiftTask does NOT call this —
 * that only updates ShiftTask.status (worker-reported progress).
 */
export async function updateTaskStatus(pageId: string, status: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;
    if (!tenantId || !userId) throw new Error('Unauthorized');

    // Verify tenant ownership via parent database
    const page = await prisma.globalPage.findUnique({
        where: { id: pageId },
        include: { database: { select: { tenantId: true } } }
    });

    if (!page || page.database.tenantId !== tenantId) {
        throw new Error('Task not found or unauthorized');
    }

    const props = page.properties as Record<string, unknown>;
    const updatedProps = {
        ...props,
        'prop-task-status': status,
        'prop-task-completed-at': status === 'opt-done' ? new Date().toISOString() : '',
        'last_edited_time': new Date().toISOString(),
    };

    await prisma.globalPage.update({
        where: { id: pageId },
        data: {
            properties: updatedProps,
            lastEditedBy: userId,
            updatedAt: new Date(),
        }
    });

    return { success: true };
}
