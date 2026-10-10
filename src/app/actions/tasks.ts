'use server';

import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';
import { scopeFromSession, platformDb } from '@/lib/data/scope';
import { saveRecord } from '@/lib/data/records';
import { buildTaskCreateData, buildTaskStatusIntent } from '@/lib/records/actions-record-intents';
import { zonedParts } from '@/lib/kernel/shift-time';

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
    const tenant = await platformDb().tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true }
    });
    const locked = (tenant?.lockedDbIds as Record<string, string>) || {};
    const tasksDbId = locked['tasks'] || 'db-tasks';

    const db = await scopeFromSession();

    // Ensure the GlobalDatabase exists in Postgres for this tenant.
    // If it doesn't, we automatically initialize/create it on the fly!
    let targetDb = await db.globalDatabase.findFirst({
        where: { id: tasksDbId },
        select: { id: true }
    });

    if (!targetDb) {
        targetDb = await db.globalDatabase.create({
            data: {
                id: tasksDbId,
                tenantId,
                name: 'Tasks',
                ownerId: userId,
                properties: {
                    title: { id: 'title', name: 'Title', type: 'title' },
                    'prop-task-status': { id: 'prop-task-status', name: 'Status', type: 'select', options: [
                        { id: 'opt-todo', name: 'Todo', color: 'gray' },
                        { id: 'opt-in-prog', name: 'In Progress', color: 'blue' },
                        { id: 'opt-done', name: 'Done', color: 'green' }
                    ]},
                    'prop-task-priority': { id: 'prop-task-priority', name: 'Priority', type: 'select', options: [
                        { id: 'opt-p1', name: 'Urgent', color: 'red' },
                        { id: 'opt-p2', name: 'High', color: 'orange' },
                        { id: 'opt-p3', name: 'Normal', color: 'blue' },
                        { id: 'opt-p4', name: 'Low', color: 'gray' }
                    ]},
                    'prop-task-project': { id: 'prop-task-project', name: 'Project', type: 'relation', databaseId: 'db-projects' },
                    'prop-task-assignee': { id: 'prop-task-assignee', name: 'Assignee', type: 'person' },
                    'prop-task-due': { id: 'prop-task-due', name: 'Due Date', type: 'date' }
                }
            },
            select: { id: true }
        });
    }

    // Get current page count for order assignment
    const pageCount = await db.globalPage.count({
        where: { databaseId: tasksDbId }
    });

    const pageId = uuidv4();
    const { intent, opts } = buildTaskCreateData(pageId, targetDb.id, userId, pageCount, input);

    const saved = await saveRecord(db, intent, opts);

    if (!saved.ok) {
        throw new Error(`Failed to create task: ${saved.refusal.code}`);
    }

    return {
        id: pageId,
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

    const db = await scopeFromSession();

    // Verify tenant ownership via scoped db
    const page = await db.globalPage.findFirst({
        where: { id: pageId },
        select: { id: true, databaseId: true, updatedAt: true }
    });

    if (!page) {
        throw new Error('Task not found or unauthorized');
    }

    const { intent, opts } = buildTaskStatusIntent(pageId, status, userId, page.updatedAt.toISOString());
    const saved = await saveRecord(db, intent, opts);

    if (!saved.ok) {
        throw new Error(`Failed to update task: ${saved.refusal.code}`);
    }

    return { success: true };
}

/**
 * Sends an email digest of open tasks to the current user via Resend (TASK-M15).
 */
export async function sendTaskDigestAction() {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const userEmail = session?.user?.email;
    const userName = session?.user?.name || undefined;
    if (!tenantId || !userEmail) throw new Error('Unauthorized');

    const tenant = await platformDb().tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true }
    });
    const locked = (tenant?.lockedDbIds as Record<string, string>) || {};
    const tasksDbId = locked['tasks'] || 'db-tasks';

    const db = await scopeFromSession();
    // Fetch open tasks for this tenant
    const pages = await db.globalPage.findMany({
        where: { databaseId: tasksDbId },
        select: { id: true, properties: true }
    });

    const nowStr = zonedParts(new Date()).date;   // the business day, not the UTC day
    const digestTasks = pages.filter(p => {
        const props = (p.properties as Record<string, any>) || {};
        const status = props['prop-task-status'];
        if (status === 'opt-done' || status === 'opt-dropped' || status === 't-done') return false;
        return true;
    }).map(p => {
        const props = (p.properties as Record<string, any>) || {};
        const due = props['prop-task-due'] as string | undefined;
        return {
            id: p.id,
            title: (props['title'] as string) || 'Untitled Task',
            due: due || undefined,
            priority: props['prop-task-priority'] as string | undefined,
            isOverdue: Boolean(due && due < nowStr),
        };
    });

    const { sendTaskDigestEmail } = await import('@/lib/email');
    const result = await sendTaskDigestEmail({
        to: userEmail,
        userName,
        tasks: digestTasks,
    });

    return { success: result.success, count: digestTasks.length };
}

