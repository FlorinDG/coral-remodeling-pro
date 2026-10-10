/**
 * STALE-SESSION-1 · a session that names a tenant or user that no longer exists ends; it never runs the app.
 * (Florin 2026-10-10: after the preview database was reset, the old session pointed at a tenant the new data did not
 * have — the shell ran with no database bindings: "unbound_system_database", an empty employee list, a scare.)
 * Happens after any restore, or when a tenant or user is deleted. Pure; the shells (admin, mobile office, WorkHub)
 * ask it once their reads are done, and send the browser to STALE_SESSION_PATH.
 */
export type StaleReason = 'impersonation' | 'tenant' | 'user';

/** `null` = a read FAILED (the database is down): that is not proof of absence — never ends a session. */
export function staleSessionReason(f: { tenantFound: boolean | null; userFound: boolean | null; impersonating: boolean }): StaleReason | null {
    if (f.tenantFound === false) return f.impersonating ? 'impersonation' : 'tenant';
    if (f.userFound === false) return 'user';
    return null;
}

export const STALE_SESSION_PATH = '/api/auth/stale-session';

export function staleSessionUrl(reason: StaleReason): string {
    return `${STALE_SESSION_PATH}?reason=${reason}`;
}
