/**
 * GATE 2 · ACTOR REACH — the ONE HR authority for "whose hours may this person see or change,
 * and may they approve". (coral-walkdown-actor-reach-writes.md · pd.md 5a)
 *
 * BRIDGE — measured, named, with an exit condition:
 *   Exit: deleted when R1-4 exposes `scope.reach()`; its callers switch in one commit.
 *   Until then: no HR route evaluates a role itself. It asks this file.
 *
 * Florin, 2026-09-30: approval and tenant-wide reach belong to tenant admin · director · HR,
 *   plus SUPERADMIN (platform), in every tenant.
 * Client-side approval of hours is a separate door: the client's signature on the werkbon
 * (WB-C) approves and freezes. It is a PORTAL actor, not a role, and is not decided here.
 */
import { isTenantHrRole } from '@/lib/roles';
import { getAccessibleUserIds } from './team-scoping';

export interface Reach {
    kind: 'tenant' | 'team' | 'self';
    /** null = the whole tenant (the seraph still scopes every query to it). */
    userIds: ReadonlySet<string> | null;
    /** approve / reject / edit others' hours and leave; write back-office HR records. */
    mayApprove: boolean;
}

/** Re-exported so HR routes keep asking this file; the definition lives in lib/roles.ts. */
export { isTenantHrRole };

export async function resolveReach(ctx: { tenantId: string; userId: string; role: string }): Promise<Reach> {
    if (isTenantHrRole(ctx.role)) {
        return { kind: 'tenant', userIds: null, mayApprove: true };
    }
    const ids = await getAccessibleUserIds(ctx.tenantId, ctx.userId);
    return { kind: ids.length > 1 ? 'team' : 'self', userIds: new Set(ids), mayApprove: false };
}

export function canActOn(reach: Reach, subjectUserId: string | null | undefined): boolean {
    if (!subjectUserId) return false;
    return reach.userIds === null || reach.userIds.has(subjectUserId);
}

/** For Prisma `where`: undefined = no extra filter (tenant reach), else `{ in: [...] }`. */
export function reachUserFilter(reach: Reach): { in: string[] } | undefined {
    return reach.userIds === null ? undefined : { in: Array.from(reach.userIds) };
}
