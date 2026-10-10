/**
 * CACHE-OWNER-1 · a copy of data kept in the browser belongs to ONE identity: the tenant AND the user that read it
 * (Florin 2026-10-10: "make sure this doesn't leak cross tenant").
 *
 * The browser outlives a sign-in: another user, another tenant, or a superadmin impersonating tenant after tenant
 * uses the same storage. A copy is shown only to the identity that wrote it. An unknown owner (a copy written before
 * this rule, or before the identity was known) is never trusted. Pure.
 */
export interface CacheOwner { tenantId: string | null | undefined; userId: string | null | undefined }

export function cacheUsableBy(owner: CacheOwner, who: CacheOwner): boolean {
    return !!owner.tenantId && !!owner.userId && owner.tenantId === who.tenantId && owner.userId === who.userId;
}

/** The prefix of a per-identity cache key, or null while the identity is unknown (then nothing is cached). */
export function ownerKey(who: CacheOwner): string | null {
    return who.tenantId && who.userId ? `${who.tenantId}|${who.userId}` : null;
}
