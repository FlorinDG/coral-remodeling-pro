/**
 * WO-3 / WB-D · THE LOCK — server-only helper, read by every writer of a work order.
 *
 * A work order = the shifts created together (`seriesId`; a shift without one is its own), on ONE
 * day — the visit. Signing writes one immutable AuditLog row per member shift
 * (entityType 'shift', action 'sign'); a shift with such a row is LOCKED for everyone, HR included:
 * "a signed document that is still editable is worse than no signature at all" (walkdown §12).
 * The grain is the work order, never the day or the worker (§13a): other jobs that day stay open.
 */
import prisma from '@/lib/prisma';

export async function isShiftSigned(tenantId: string, shiftId: string | null | undefined): Promise<boolean> {
    if (!shiftId) return false;
    const row = await prisma.auditLog.findFirst({
        where: { tenantId, entityType: 'shift', entityId: shiftId, action: 'sign' },
        select: { id: true },
    });
    return !!row;
}

/** The members of the work order this shift belongs to, on its day. */
export async function workOrderMembers(tenantId: string, shiftId: string) {
    const anchor = await prisma.scheduledShift.findFirst({
        where: { id: shiftId, tenantId },
        select: { id: true, seriesId: true, shiftDate: true },
    });
    if (!anchor) return null;
    const members = anchor.seriesId
        ? await prisma.scheduledShift.findMany({
            where: { tenantId, seriesId: anchor.seriesId, shiftDate: anchor.shiftDate, status: { not: 'leave' } },
            select: { id: true, userId: true, shiftStart: true, shiftEnd: true, status: true },
            orderBy: { shiftStart: 'asc' },
        })
        : await prisma.scheduledShift.findMany({
            where: { id: anchor.id, tenantId },
            select: { id: true, userId: true, shiftStart: true, shiftEnd: true, status: true },
        });
    return { anchor, members };
}

/** The refusal every writer returns for a locked shift. */
export const SIGNED_REFUSAL = 'work_order_signed';
