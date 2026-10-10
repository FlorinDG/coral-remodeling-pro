/**
 * IMPERSONATE-1 · the ONE gate of the platform's cross-tenant powers (Florin 2026-10-10: "Impersonation must not be
 * able to cross tenant, even superadmin — if in an impersonation session, guard to the current tenant").
 *
 * A platform admin (SUPERADMIN / TENANT_MANAGER) reaches every tenant through /superadmin, its actions, the
 * cross-tenant password reset and the schema cleanup. While impersonating, the session IS the impersonated tenant:
 * the scoped doors keep every read and write inside it, and the platform powers are refused here until the
 * impersonation ends (stopImpersonation is the one exit). Entering another tenant also needs the exit first.
 */
import { auth } from '@/auth';
import { platformAccessOf, type PlatformAccess } from '@/lib/roles';
export { platformAccessOf, type PlatformAccess };


export class PlatformAccessError extends Error {
    readonly access: PlatformAccess;
    constructor(access: PlatformAccess) {
        super(access === 'impersonating'
            ? 'impersonating: platform tools are closed during an impersonation — exit it first'
            : 'Unauthorized: Platform admin role required.');
        this.name = 'PlatformAccessError';
        this.access = access;
    }
}

/** The session's platform access (for pages that redirect instead of throwing). */
export async function platformAccess(): Promise<PlatformAccess> {
    const session = await auth();
    return platformAccessOf(session?.user?.role, (session?.user as { isImpersonating?: boolean } | undefined)?.isImpersonating);
}

/** Every cross-tenant power asks this first. Throws unless a platform admin who is NOT impersonating. */
export async function requirePlatformAdmin(): Promise<void> {
    const access = await platformAccess();
    if (access !== 'platform') throw new PlatformAccessError(access);
}
