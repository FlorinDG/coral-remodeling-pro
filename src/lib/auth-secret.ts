/**
 * AUTH-SECRET-1 · the ONE place the session-signing secret is read — fail-closed (Florin 2026-10-10: "AUTH_SECRET
 * missing — in this case we need to throw, rely on a nice ui to communicate it, but nothing moves forward").
 *
 * Before, three files fell back to a password written in the source when AUTH_SECRET was unset: anyone who read it
 * could sign a session for any user. Now: no secret → no session is decoded or issued, and every page shows the
 * not-configured notice (middleware) instead of the app.
 */
export class AuthNotConfiguredError extends Error {
    constructor() { super('AUTH_SECRET is not set — sign-in is disabled until it is configured'); this.name = 'AuthNotConfiguredError'; }
}

/** Pure decision (tested): the configured secret, or null when there is none. */
export function authSecretOf(value: string | undefined | null): string | null {
    return value && value.trim() ? value : null;
}

/** The secret, or a throw — never a default. */
export function authSecret(): string {
    const s = authSecretOf(process.env.AUTH_SECRET);
    if (!s) throw new AuthNotConfiguredError();
    return s;
}
