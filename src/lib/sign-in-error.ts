/**
 * SIGNIN-ERR-1 · what a failed sign-in means (Florin 2026-10-10: "Invalid credentials" on the preview while the
 * database password had been reset — every failure was reported as a wrong password). Pure.
 * Auth.js answers `CredentialsSignin` when the account / password do not match (authorize returned null) and another
 * code (`Configuration`, `CallbackRouteError` …) when the server failed (database unreachable, a thrown error).
 */
export type SignInFailure = { kind: 'credentials' } | { kind: 'server'; code: string };

export function signInFailure(error: string | null | undefined): SignInFailure | null {
    if (!error) return null;
    if (error === 'CredentialsSignin' || error.includes('CredentialsSignin')) return { kind: 'credentials' };
    return { kind: 'server', code: error };
}
