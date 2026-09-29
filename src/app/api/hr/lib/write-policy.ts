/**
 * GATE 2 · the HR WRITE POLICY — pure (no I/O, no Prisma), so it is tested directly.
 * coral-walkdown-actor-reach-writes.md · Florin 2026-09-30: only tenant HR roles
 * (tenant admin · director · HR) write the back office or approve. The crew gets named
 * self-service on their OWN records, always pending.
 *
 * NOT yet covered (Gate 2 phase 2, recorded): shifts, shift-tasks, shift-attachments —
 * crew self-service on their own shifts needs reach-on-parent, which rides with R1-4.
 */

export interface Refusal { code: 'requires_hr_role' | 'own_records_only' | 'approval_requires_hr_role'; detail?: string }

/** Back-office HR records: written only by tenant HR roles. */
export const HR_ROLE_ONLY_ENTITIES: ReadonlySet<string> = new Set([
    'employees', 'teams', 'team-members', 'shift-templates', 'worker-schedules', 'projects',
]);

/** What a worker may change on their OWN clock entry: closing it, and linking its shift. */
export const CLOCK_ENTRY_SELF_PATCH_FIELDS: ReadonlySet<string> = new Set([
    'clockOutTime', 'clockOutLatitude', 'clockOutLongitude', 'taskDescription', 'photos', 'noBreak', 'shiftId',
]);

const refuse = (code: Refusal['code'], detail?: string): Refusal => ({ code, detail });

export function hrWriteRefusal(
    entity: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    mayApprove: boolean,
    actorId: string,
    data: Record<string, unknown>,
    existing: Record<string, unknown> | null,
): Refusal | null {
    if (mayApprove) return null;

    if (HR_ROLE_ONLY_ENTITIES.has(entity)) return refuse('requires_hr_role', entity);

    if (entity === 'clock-entries') {
        if (method === 'DELETE') return refuse('requires_hr_role', 'hours are never deleted by the crew');
        if (method === 'POST') {
            if (data.userId !== actorId) return refuse('own_records_only');
            if (data.approvalStatus !== undefined && data.approvalStatus !== 'pending') return refuse('approval_requires_hr_role');
            if (data.source === 'admin_entry') return refuse('requires_hr_role', 'admin_entry');
            return null;
        }
        if (!existing || existing.userId !== actorId) return refuse('own_records_only');
        const extra = Object.keys(data).filter(k => !CLOCK_ENTRY_SELF_PATCH_FIELDS.has(k));
        if (extra.length) return refuse('requires_hr_role', extra.join(','));
        if ('clockOutTime' in data && existing.clockOutTime) return refuse('requires_hr_role', 'entry already closed');
        return null;
    }

    if (entity === 'time-off') {
        if (method === 'DELETE') return refuse('requires_hr_role', 'withdraw instead');
        if (method === 'POST') {
            if (data.userId !== actorId) return refuse('own_records_only');
            if (data.status !== undefined && data.status !== 'pending') return refuse('approval_requires_hr_role');
            return null;
        }
        if (!existing || existing.userId !== actorId) return refuse('own_records_only');
        if (Object.keys(data).length !== 1 || data.status !== 'cancelled') return refuse('approval_requires_hr_role');
        if (existing.status !== 'pending') return refuse('requires_hr_role', 'only a pending request can be withdrawn');
        return null;
    }

    if (entity === 'approval-requests') {
        if (method !== 'POST') return refuse('approval_requires_hr_role');
        if (data.userId !== actorId) return refuse('own_records_only');
        if (data.requestedBy !== undefined && data.requestedBy !== actorId) return refuse('own_records_only');
        if (data.status !== undefined && data.status !== 'pending') return refuse('approval_requires_hr_role');
        if (data.reviewedBy !== undefined || data.reviewedAt !== undefined) return refuse('approval_requires_hr_role');
        return null;
    }

    return null;
}
