"use server";
/**
 * WO-3 · signing a work order (WB-C) — the client signs on the crew's phone, with their name.
 *
 * Signing freezes the EVIDENCE, not a reference (walkdown §9a): the AuditLog row carries the hours
 * exactly as signed (every entry of every member shift) plus the signer's name and the signature
 * image key. The rows are immutable (POST/PATCH on audit-logs is refused), and their presence is
 * the lock every writer checks (work-order-lock.ts).
 *
 * Reach: a crew member signs a work order they are ON (one of the member shifts is theirs);
 * tenant HR roles sign any. Refused while anyone is still clocked in on it, or when already signed.
 */
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { isTenantHrRole } from '@/lib/roles';
import { storage } from '@/lib/storage';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { workOrderMembers } from './work-order-lock';
import { zonedParts } from '@/lib/kernel/shift-time';
import { nextWerkbonNumber } from '@/lib/records/werkbon-number';

type Fail = { ok: false; error: string; detail?: string };

class SignRefused extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
}

export interface WorkOrderSummary {
    members: Array<{ shiftId: string; workerName: string | null; entries: Array<{ in: string; out: string | null; minutes: number }> }>;
    totalMinutes: number;
    openEntries: number;
    signed: null | { signerName: string; signedAt: string; signatureUrl: string };
}

async function actor() {
    const s = await auth();
    const tenantId = s?.user?.tenantId; const userId = s?.user?.id;
    const role = (s?.user as { role?: string } | undefined)?.role;
    return tenantId && userId ? { tenantId, userId, hr: isTenantHrRole(role) } : null;
}

async function load(tenantId: string, shiftId: string) {
    const wo = await workOrderMembers(tenantId, shiftId);
    if (!wo) return null;
    const ids = wo.members.map(m => m.id);
    const [entries, users, signRow] = await Promise.all([
        prisma.clockEntry.findMany({
            where: { tenantId, shiftId: { in: ids } },
            select: { id: true, shiftId: true, userId: true, clockInTime: true, clockOutTime: true, noBreak: true },
            orderBy: { clockInTime: 'asc' },
        }),
        prisma.user.findMany({ where: { tenantId, id: { in: wo.members.map(m => m.userId) } }, select: { id: true, name: true } }),
        prisma.auditLog.findFirst({
            where: { tenantId, entityType: 'shift', entityId: { in: ids }, action: 'sign' },
            select: { after: true, createdAt: true },
        }),
    ]);
    return { wo, entries, users, signRow };
}

export async function getWorkOrderSummary(shiftId: string): Promise<{ ok: true; summary: WorkOrderSummary } | Fail> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const d = await load(a.tenantId, shiftId);
    if (!d || (!a.hr && !d.wo.members.some(m => m.userId === a.userId))) return { ok: false, error: 'not_found' };

    const nameOf = new Map(d.users.map(u => [u.id, u.name]));
    let total = 0;
    const members = d.wo.members.map(m => ({
        shiftId: m.id,
        workerName: nameOf.get(m.userId) || null,
        entries: d.entries.filter(e => e.shiftId === m.id).map(e => {
            const minutes = e.clockOutTime ? computeWorkedDuration(e.clockInTime, e.clockOutTime, e.noBreak).totalMinutes : 0;
            total += minutes;
            return { in: e.clockInTime.toISOString(), out: e.clockOutTime ? e.clockOutTime.toISOString() : null, minutes };
        }),
    }));
    const after = (d.signRow?.after || null) as { signerName?: string; signatureKey?: string } | null;
    return {
        ok: true,
        summary: {
            members,
            totalMinutes: total,
            openEntries: d.entries.filter(e => !e.clockOutTime).length,
            signed: d.signRow && after?.signerName
                ? { signerName: after.signerName, signedAt: d.signRow.createdAt.toISOString(), signatureUrl: after.signatureKey || '' }
                : null,
        },
    };
}

export async function signWorkOrder(input: { shiftId: string; signerName: string; signaturePng: string }):
    Promise<{ ok: true } | Fail> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const signerName = String(input.signerName || '').trim().slice(0, 120);
    if (signerName.length < 2) return { ok: false, error: 'signer_name_required' };
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.signaturePng || '');
    if (!m) return { ok: false, error: 'signature_required' };
    const png = Buffer.from(m[1], 'base64');
    if (png.length < 200 || png.length > 500_000) return { ok: false, error: 'signature_invalid' };

    const d = await load(a.tenantId, input.shiftId);
    if (!d || (!a.hr && !d.wo.members.some(mb => mb.userId === a.userId))) return { ok: false, error: 'not_found' };
    if (d.signRow) return { ok: false, error: 'already_signed' };
    if (d.entries.some(e => !e.clockOutTime)) return { ok: false, error: 'still_clocked_in' };

    try {
        const key = `t_${a.tenantId}/hr-shift/${d.wo.anchor.id}/signature-${Date.now()}.png`;
        const put = await storage.put(key, png, { contentType: 'image/png' });
        const signatureKey = put.key || key;
        const signedAt = new Date().toISOString();
        const evidence = {
            signerName, signatureKey, signedAt,
            shiftIds: d.wo.members.map(mb => mb.id),
            // the hours AS SIGNED — the evidence is frozen, not a reference to rows that may change
            entries: d.entries.map(e => ({
                id: e.id, shiftId: e.shiftId, userId: e.userId,
                in: e.clockInTime.toISOString(), out: e.clockOutTime ? e.clockOutTime.toISOString() : null,
                // WO-4b: the worked minutes AS SIGNED — the break rule applied (30 min deducted automatically on a
                // stretch over 4 h; the crew member's "no break" tick says none was taken) — never a recount later.
                noBreak: e.noBreak,
                minutes: e.clockOutTime ? computeWorkedDuration(e.clockInTime, e.clockOutTime, e.noBreak).totalMinutes : 0,
            })),
        };
        const ids = d.wo.members.map(mb => mb.id);
        const year = zonedParts(new Date()).date.slice(0, 4);   // the Brussels year of the signature
        // Re-checked INSIDE a serializable transaction: two phones signing at once, or a clock-in
        // landing between the check above and this write, make one of them fail — never two
        // signatures, never hours outside the signed evidence. WO-4b: the work order NUMBER is assigned
        // here too (WB-YYYY-NNNN, frozen in the evidence); two DIFFERENT work orders signed at the same
        // moment collide on the sequence → retried (a real double signature still answers already_signed).
        const signOnce = () => prisma.$transaction(async tx => {
            const [already, open, issued] = await Promise.all([
                tx.auditLog.findFirst({ where: { tenantId: a.tenantId, entityType: 'shift', entityId: { in: ids }, action: 'sign' }, select: { id: true } }),
                tx.clockEntry.count({ where: { tenantId: a.tenantId, shiftId: { in: ids }, clockOutTime: null } }),
                tx.auditLog.findMany({
                    where: { tenantId: a.tenantId, entityType: 'shift', action: 'sign', after: { path: ['number'], string_starts_with: `WB-${year}-` } },
                    select: { after: true },
                }),
            ]);
            if (already) throw new SignRefused('already_signed');
            if (open) throw new SignRefused('still_clocked_in');
            const number = nextWerkbonNumber(issued.map(r => (r.after as { number?: string } | null)?.number), year);
            const signed = { ...evidence, number };
            for (const mb of d.wo.members) {
                await buildAuditLogOperation(tx, await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                    entityType: 'shift', entityId: mb.id, action: 'sign', field: null,
                    before: null, after: signed, reason: 'client signature',
                }));
                await tx.shiftAttachment.create({
                    data: { shiftId: mb.id, name: `Handtekening — ${signerName}.png`, url: signatureKey, type: 'image/png', size: png.length },
                });
            }
            return number;
        }, { isolationLevel: 'Serializable' });

        let number: string | null = null;
        for (let attempt = 1; ; attempt++) {
            try { number = await signOnce(); break; }
            catch (err) {
                if ((err as { code?: string })?.code === 'P2034' && attempt < 3) continue;   // a concurrent signature elsewhere
                throw err;
            }
        }
        void number;   // WO-4b M1 next: the PDF is generated from the evidence after this commit
        return { ok: true };
    } catch (err) {
        if (err instanceof SignRefused) return { ok: false, error: err.code };
        // Postgres serialization failure (P2034): another signature or clock-in won the race.
        if ((err as { code?: string })?.code === 'P2034') return { ok: false, error: 'already_signed' };
        console.error('[signWorkOrder] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}
