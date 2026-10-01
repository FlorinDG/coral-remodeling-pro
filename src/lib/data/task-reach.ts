/**
 * Crew task reach — ONE rule, read by the task list (HR API `erp-tasks`) and the task writes
 * (task-crew.ts). Server-only helper, not a "use server" module.
 *
 * A worker's task is one that is assigned to them, created by them, OR attached to one of their
 * shifts (ShiftTask). The last part was missing: a task the office put on a crew member's shift was
 * invisible to that crew member — the shift showed "Task" instead of its title and the Tasks screen
 * did not list it (Florin 2026-10-01).
 */
import prisma from '@/lib/prisma';

/** Ids of tasks attached to shifts of these users, in this tenant. */
export async function shiftTaskIdsFor(tenantId: string, userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const rows = await prisma.shiftTask.findMany({
        where: { shift: { tenantId, userId: { in: userIds } } },
        select: { taskId: true },
    });
    return Array.from(new Set(rows.map(r => r.taskId)));
}

/** Is this task attached to one of this user's shifts? */
export async function isOnMyShift(tenantId: string, userId: string, taskId: string): Promise<boolean> {
    const hit = await prisma.shiftTask.findFirst({
        where: { taskId, shift: { tenantId, userId } },
        select: { id: true },
    });
    return !!hit;
}
