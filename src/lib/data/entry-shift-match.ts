/**
 * SHIFT-LINK-1 · server helpers (NOT a "use server" file — nothing here is callable from a browser).
 * Florin 2026-10-01: "if you can map them correctly, the app can fix them, otherwise I accept the
 * suggestion. suggestion must be editable … last few days, by hand — just surface them."
 *
 * autoLinkIfUnique — at CREATION of a recorded (closed) entry with no shift: link it when exactly one
 * of the worker's shifts that local day overlaps it. Never touches existing entries (those are
 * surfaced for review instead). Audited in the same transaction.
 */
import prisma from '@/lib/prisma';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import { entrySpan, matchSpanToShifts, isShiftSubmitted } from '@/lib/kernel/shift-time';

export async function autoLinkIfUnique(entryId: string, actor: { tenantId: string; userId: string }): Promise<string | null> {
    const entry = await prisma.clockEntry.findFirst({
        where: { id: entryId, tenantId: actor.tenantId },
        select: { id: true, userId: true, clockInTime: true, clockOutTime: true, shiftId: true, projectId: true },
    });
    if (!entry || entry.shiftId || !entry.clockOutTime) return null;

    const span = entrySpan(entry.clockInTime, entry.clockOutTime);
    const shifts = await prisma.scheduledShift.findMany({
        where: { tenantId: actor.tenantId, userId: entry.userId, shiftDate: span.date },
        select: { id: true, shiftDate: true, shiftStart: true, shiftEnd: true, status: true, projectId: true },
    });
    const open = shifts.filter(s => !isShiftSubmitted(s.status));
    const { unique } = matchSpanToShifts(span, open);
    if (!unique) return null;

    const data: { shiftId: string; projectId?: string } = { shiftId: unique.id };
    if (!entry.projectId && unique.projectId) data.projectId = unique.projectId;
    const audit = await buildAuditLogData({ tenantId: actor.tenantId, userId: actor.userId }, {
        entityType: 'clockEntry', entityId: entry.id, action: 'shift_link', field: 'shiftId',
        before: { shiftId: null, projectId: entry.projectId }, after: data,
        reason: 'auto: the only shift that day overlapping these hours',
    });
    await prisma.$transaction([
        prisma.clockEntry.update({ where: { id: entry.id }, data }),
        buildAuditLogOperation(prisma, audit),
    ]);
    return unique.id;
}
