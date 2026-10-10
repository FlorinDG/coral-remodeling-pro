"use server";
/**
 * Timesheets · the SHIFT behind a clock entry, read-only, in the entry's detail pane (Florin
 * 2026-10-01: "I will spend more time in the timesheets than the scheduler — avoid back and forth").
 * The planner's note, the task list with worker progress, the attachments, the crew member's note.
 *
 * Reach: tenant HR roles read any entry of the tenant; anyone else only their own.
 */
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { isTenantHrRole } from '@/lib/roles';
import { orderGiverIdOf } from '@/lib/records/order-giver';

export interface EntryShiftContext {
    shiftId: string;
    shiftTraceNo: string | null;      // TRACE-1
    shiftDate: string;
    shiftLabel: string;               // date + planned times
    plannerNote: string | null;       // ScheduledShift.notes (the editor's "Description")
    /** The rest of the shift editor's Details tab (Florin 2026-10-10: "the DETAILS of the shift" were missing). */
    details: { projectName: string | null; orderGiver: string | null; role: string | null; siteAddress: string | null; materialsEnabled: boolean };
    crewNote: string | null;          // ScheduledShift.crewNote (WO-2)
    tasks: Array<{ id: string; title: string; status: string; workerNotes: string | null; subtasksDone: number; subtasksTotal: number }>;
    attachments: Array<{ id: string; name: string; url: string; type: string }>;
}

export async function getEntryShiftContext(entryId: string): Promise<{ ok: true; context: EntryShiftContext | null } | { ok: false; error: string }> {
    const s = await auth();
    const tenantId = s?.user?.tenantId; const userId = s?.user?.id;
    const role = (s?.user as { role?: string } | undefined)?.role;
    if (!tenantId || !userId) return { ok: false, error: 'unauthorized' };

    const entry = await prisma.clockEntry.findFirst({ where: { id: entryId, tenantId }, select: { userId: true, shiftId: true } });
    if (!entry || (!isTenantHrRole(role) && entry.userId !== userId)) return { ok: false, error: 'not_found' };
    if (!entry.shiftId) return { ok: true, context: null };

    const shift = await prisma.scheduledShift.findFirst({
        where: { id: entry.shiftId, tenantId },
        select: {
            id: true, traceNo: true, shiftDate: true, shiftStart: true, shiftEnd: true, notes: true, crewNote: true,
            role: true, siteAddress: true, materialsEnabled: true, projectId: true, contactPageId: true,
            tasks: { select: { id: true, taskId: true, status: true, workerNotes: true, subtasks: true }, orderBy: { createdAt: 'asc' } },
            attachments: { select: { id: true, name: true, url: true, type: true }, orderBy: { createdAt: 'asc' } },
        },
    });
    if (!shift) return { ok: true, context: null };

    const pages = shift.tasks.length
        ? await prisma.globalPage.findMany({
            where: { id: { in: shift.tasks.map(t => t.taskId) }, database: { tenantId, logicalKey: 'tasks' } },
            select: { id: true, properties: true },
        })
        : [];
    const titleOf = new Map(pages.map(p => {
        const props = (p.properties || {}) as Record<string, unknown>;
        return [p.id, String(props.title || props.name || '').trim()];
    }));

    // The project and the order giver (END-CLIENT-1: the shift's client, else the project's) — this tenant's pages only.
    const project = shift.projectId
        ? await prisma.globalPage.findFirst({ where: { id: shift.projectId, database: { tenantId, logicalKey: 'projects' } }, select: { properties: true } })
        : null;
    const giverId = orderGiverIdOf(shift.contactPageId, project?.properties ?? null);
    const giver = giverId
        ? await prisma.globalPage.findFirst({ where: { id: giverId, database: { tenantId, logicalKey: 'clients' } }, select: { properties: true } })
        : null;
    const titleOfProps = (p: unknown) => String(((p || {}) as Record<string, unknown>).title || '').trim() || null;

    return {
        ok: true,
        context: {
            shiftId: shift.id,
            shiftTraceNo: shift.traceNo ?? null,
            shiftDate: shift.shiftDate,
            shiftLabel: `${shift.shiftDate} · ${shift.shiftStart}–${shift.shiftEnd}`,
            plannerNote: shift.notes?.trim() || null,
            details: {
                projectName: titleOfProps(project?.properties),
                orderGiver: titleOfProps(giver?.properties),
                role: shift.role?.trim() || null,
                siteAddress: shift.siteAddress?.trim() || null,
                materialsEnabled: !!shift.materialsEnabled,
            },
            crewNote: shift.crewNote?.trim() || null,
            tasks: shift.tasks.map(t => {
                const subs = Array.isArray(t.subtasks) ? (t.subtasks as Array<{ done?: boolean }>) : [];
                return {
                    id: t.id,
                    title: titleOf.get(t.taskId) || '—',
                    status: t.status,
                    workerNotes: t.workerNotes?.trim() || null,
                    subtasksDone: subs.filter(x => x?.done).length,
                    subtasksTotal: subs.length,
                };
            }),
            attachments: shift.attachments.map(a => ({ id: a.id, name: a.name || 'Bijlage', url: a.url || '', type: a.type || '' })),
        },
    };
}
