"use server";
/**
 * SHIFT-LINK-1 · the review: recorded hours that are not linked to a shift, or are linked to a shift
 * they do not overlap while another shift that day does. Each comes with an EDITABLE suggestion —
 * every shift of that worker's day is offered (Florin: "not just deny it, but actually replace it").
 *
 * Reach (Gate 2): tenant HR roles review everyone; anyone else reviews their own hours.
 * Every link change is audited (AuditLog, same transaction). Hours are never changed here — only
 * which shift (and, when it came from the shift, which project) they belong to.
 *
 * "Reviewed" needs no new column: every review writes a `shift_link` AuditLog row (reason review*),
 * also when the person KEEPS the current link. An entry whose latest review row names its current
 * shift (or none) has been looked at by a human and is not surfaced again.
 */
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { isTenantHrRole } from '@/lib/roles';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import { entrySpan, matchSpanToShifts, isShiftSubmitted, overlapMinutes } from '@/lib/kernel/shift-time';
import { isShiftSigned } from '@/lib/data/work-order-lock';

export interface ShiftOption { id: string; traceNo: string | null; label: string; start: string; end: string; overlap: number; submitted: boolean }
export interface ShiftLinkItem {
    entryId: string;
    traceNo: string | null;             // TRACE-1: the hours' number (HR-…), shown where it waits for its shift
    workerName: string | null;
    date: string; start: string; end: string;
    source: string | null;
    reason: 'unlinked' | 'mismatch';
    currentShift: ShiftOption | null;   // what it is linked to now (may be on another day)
    suggestedShiftId: string | null;    // best overlap; null when nothing overlaps
    options: ShiftOption[];             // every shift of that worker's day, best first
}

async function actor() {
    const s = await auth();
    const tenantId = s?.user?.tenantId; const userId = s?.user?.id;
    const role = (s?.user as { role?: string } | undefined)?.role;
    return tenantId && userId ? { tenantId, userId, hr: isTenantHrRole(role) } : null;
}

function label(s: { shiftName: string | null; notes: string | null }, projectName?: string) {
    return (projectName || s.shiftName || s.notes || '').trim();
}

/** `mine`: only the caller's own hours (My hours), even for an HR role. */
export async function listShiftLinkReview(days = 14, mine = false): Promise<{ ok: true; items: ShiftLinkItem[] } | { ok: false; error: string }> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 62) * 86_400_000);

    const entries = await prisma.clockEntry.findMany({
        where: { tenantId: a.tenantId, clockInTime: { gte: since }, clockOutTime: { not: null }, ...(a.hr && !mine ? {} : { userId: a.userId }) },
        select: { id: true, traceNo: true, userId: true, clockInTime: true, clockOutTime: true, shiftId: true, source: true },
        orderBy: { clockInTime: 'asc' },
    });
    if (!entries.length) return { ok: true, items: [] };

    const spans = new Map(entries.map(e => [e.id, entrySpan(e.clockInTime, e.clockOutTime as Date)]));
    const userIds = Array.from(new Set(entries.map(e => e.userId)));
    const dates = Array.from(new Set(Array.from(spans.values()).map(s => s.date)));
    const linkedIds = Array.from(new Set(entries.map(e => e.shiftId).filter(Boolean))) as string[];

    const shifts = await prisma.scheduledShift.findMany({
        where: { tenantId: a.tenantId, OR: [{ userId: { in: userIds }, shiftDate: { in: dates } }, { id: { in: linkedIds } }] },
        select: { id: true, traceNo: true, userId: true, shiftDate: true, shiftStart: true, shiftEnd: true, status: true, shiftName: true, notes: true, projectId: true },
    });
    const reviews = await prisma.auditLog.findMany({
        where: { tenantId: a.tenantId, entityType: 'clockEntry', action: 'shift_link', reason: { startsWith: 'review' }, entityId: { in: entries.map(e => e.id) } },
        select: { entityId: true, after: true },
        orderBy: { createdAt: 'asc' },
    });
    const reviewedAs = new Map<string, string | null>();
    for (const r of reviews) reviewedAs.set(r.entityId, ((r.after || {}) as { shiftId?: string | null }).shiftId ?? null);

    // WO-3: hours on a signed work order cannot be re-linked — never offer them.
    const signedShiftIds = new Set((await prisma.auditLog.findMany({
        where: { tenantId: a.tenantId, entityType: 'shift', action: 'sign', entityId: { in: shifts.map(sh => sh.id) } },
        select: { entityId: true },
    })).map(r => r.entityId));

    const users = await prisma.user.findMany({ where: { id: { in: userIds }, tenantId: a.tenantId }, select: { id: true, name: true } });
    const nameOf = new Map(users.map(u => [u.id, u.name]));
    const byId = new Map(shifts.map(s => [s.id, s]));

    const items: ShiftLinkItem[] = [];
    for (const e of entries) {
        const span = spans.get(e.id)!;
        const day = shifts.filter(s => s.userId === e.userId && s.shiftDate === span.date);
        const { ranked } = matchSpanToShifts(span, day);
        const best = ranked.find(r => r.overlap > 0 && !signedShiftIds.has(r.shift.id)) || null;
        const cur = e.shiftId ? byId.get(e.shiftId) || null : null;
        const curOverlap = cur ? overlapMinutes(span, cur) : 0;

        const reason: ShiftLinkItem['reason'] | null =
            !e.shiftId ? 'unlinked'
            : best && best.shift.id !== e.shiftId && curOverlap < best.overlap ? 'mismatch'
            : null;
        if (!reason) continue;
        if (e.shiftId && signedShiftIds.has(e.shiftId)) continue;
        if (reviewedAs.has(e.id) && reviewedAs.get(e.id) === (e.shiftId ?? null)) continue;

        const opt = (s: typeof shifts[number], overlap: number): ShiftOption => ({
            id: s.id, traceNo: s.traceNo ?? null, label: label(s), start: s.shiftStart, end: s.shiftEnd, overlap, submitted: isShiftSubmitted(s.status),
        });
        items.push({
            entryId: e.id,
            traceNo: e.traceNo ?? null,
            workerName: nameOf.get(e.userId) || null,
            date: span.date, start: span.start, end: span.end,
            source: e.source,
            reason,
            currentShift: cur ? { ...opt(cur, curOverlap), label: cur.shiftDate === span.date ? label(cur) : `${cur.shiftDate} ${label(cur)}`.trim() } : null,
            suggestedShiftId: best?.shift.id ?? null,
            options: ranked.filter(r => !signedShiftIds.has(r.shift.id)).map(r => opt(r.shift, r.overlap)),
        });
    }
    return { ok: true, items: items.reverse() }; // newest first
}

/** Link (or unlink with null) an entry to a shift of the SAME worker. Audited. */
export async function linkEntryToShift(entryId: string, shiftId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const entry = await prisma.clockEntry.findFirst({
        where: { id: entryId, tenantId: a.tenantId },
        select: { id: true, userId: true, shiftId: true, projectId: true },
    });
    if (!entry || (!a.hr && entry.userId !== a.userId)) return { ok: false, error: 'not_found' };
    const keep = (entry.shiftId ?? null) === shiftId;
    // WO-3: hours on a signed work order stay where they were signed; none move into one either.
    if (!keep && (await isShiftSigned(a.tenantId, entry.shiftId) || await isShiftSigned(a.tenantId, shiftId))) {
        return { ok: false, error: 'work_order_signed' };
    }   // "this is right as it is" — recorded, nothing changes

    let next: { id: string; projectId: string | null } | null = null;
    if (shiftId && !keep) {
        const s = await prisma.scheduledShift.findFirst({
            where: { id: shiftId, tenantId: a.tenantId, userId: entry.userId },
            select: { id: true, projectId: true, status: true },
        });
        if (!s) return { ok: false, error: 'shift_not_found' };
        if (isShiftSubmitted(s.status) && !a.hr) return { ok: false, error: 'shift_submitted' };
        next = s;
    }
    const prev = entry.shiftId
        ? await prisma.scheduledShift.findFirst({ where: { id: entry.shiftId, tenantId: a.tenantId }, select: { projectId: true } })
        : null;

    // The project follows the shift only when it CAME from the shift (or was empty); a project someone
    // chose for these hours on purpose is kept (pd.md 4x — attribution is its own act).
    const projectFromShift = !entry.projectId || (prev && entry.projectId === prev.projectId);
    const data: { shiftId: string | null; projectId?: string | null } = { shiftId };
    if (projectFromShift && !keep) data.projectId = next?.projectId ?? null;

    try {
        const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
            entityType: 'clockEntry', entityId: entry.id, action: 'shift_link', field: 'shiftId',
            before: { shiftId: entry.shiftId, projectId: entry.projectId }, after: data,
            reason: `${entry.userId === a.userId ? 'review' : 'review-by-hr'}${keep ? ':kept' : ''}`,
        });
        if (keep) await buildAuditLogOperation(prisma, audit);
        else await prisma.$transaction([prisma.clockEntry.update({ where: { id: entry.id }, data }), buildAuditLogOperation(prisma, audit)]);
        return { ok: true };
    } catch (err) {
        console.error('[linkEntryToShift] failed:', err);
        return { ok: false, error: `failed: ${err instanceof Error ? err.message : String(err)}` };
    }
}
