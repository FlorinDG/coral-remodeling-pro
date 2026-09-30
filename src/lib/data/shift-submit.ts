"use server";
/**
 * THE ONE DOOR that completes a shift (Florin 2026-09-30): the crew member submits it.
 * Nothing else — not clock-out, not finished tasks, not creation — may set a shift `completed`.
 *
 * Refuses: someone else's shift (HR roles may submit on a worker's behalf) · a shift already
 * submitted · an OPEN clock entry on it (clock out first) · a shift with no clocked hours at all
 * (submitting would assert work that was not recorded).
 * The status change and its audit row are ONE transaction (CORE-3: a record and its side effect
 * must never be able to disagree).
 */
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { isTenantHrRole } from "@/lib/roles";
import { buildAuditLogData, buildAuditLogOperation } from "@/lib/audit";
import { isShiftSubmitted } from "@/lib/kernel/shift-time";

export type SubmitShiftResult =
    | { ok: true; submittedAt: string }
    | { ok: false; error: 'unauthorized' | 'not_found' | 'already_submitted' | 'clock_out_first' | 'nothing_recorded' | 'failed'; detail?: string };

export async function submitShift(shiftId: string): Promise<SubmitShiftResult> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const actorId = session?.user?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!tenantId || !actorId) return { ok: false, error: 'unauthorized' };

    const shift = await prisma.scheduledShift.findFirst({
        where: { id: shiftId, tenantId },
        select: { id: true, userId: true, status: true, clockEntries: { select: { id: true, clockOutTime: true } } },
    });
    // A foreign shift and someone else's shift read the same: not found (no existence oracle).
    if (!shift || (shift.userId !== actorId && !isTenantHrRole(role))) return { ok: false, error: 'not_found' };
    if (isShiftSubmitted(shift.status)) return { ok: false, error: 'already_submitted' };
    if (shift.clockEntries.some(e => e.clockOutTime === null)) return { ok: false, error: 'clock_out_first' };
    if (shift.clockEntries.length === 0) return { ok: false, error: 'nothing_recorded' };

    const submittedAt = new Date();
    try {
        const audit = await buildAuditLogData(
            { tenantId, userId: actorId },
            {
                entityType: 'scheduledShift',
                entityId: shift.id,
                action: 'submit',
                field: 'status',
                before: { status: shift.status },
                after: { status: 'completed', submittedAt: submittedAt.toISOString(), clockEntries: shift.clockEntries.length },
                reason: shift.userId === actorId ? null : 'submitted-on-behalf',
            },
        );
        await prisma.$transaction([
            prisma.scheduledShift.update({ where: { id: shift.id }, data: { status: 'completed', lastEditedBy: actorId } }),
            buildAuditLogOperation(prisma, audit),
        ]);
        return { ok: true, submittedAt: submittedAt.toISOString() };
    } catch (err) {
        console.error('[submitShift] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}
