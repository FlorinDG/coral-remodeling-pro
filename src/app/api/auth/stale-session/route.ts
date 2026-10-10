/**
 * STALE-SESSION-1 · the exit for a session whose tenant or user no longer exists (lib/session-guard).
 * - impersonation of a tenant that is gone: only the impersonation ends → back to the platform panel;
 * - otherwise: the session cookies are cleared → sign-in, with a short notice (?session=stale).
 * It only ever clears the CALLER's own cookies.
 */
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'];
const IMPERSONATION_COOKIE = 'x-impersonate-tenant';

/** A `__Secure-` cookie is only replaced by one that is Secure too — a plain delete would be ignored by the browser. */
function expire(res: NextResponse, name: string) {
    res.cookies.set(name, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: name.startsWith('__Secure-') || process.env.NODE_ENV === 'production' });
}

export async function GET(req: NextRequest) {
    const reason = req.nextUrl.searchParams.get('reason');
    const origin = req.nextUrl.origin;
    if (reason === 'impersonation') {
        const res = NextResponse.redirect(new URL('/superadmin', origin));
        expire(res, IMPERSONATION_COOKIE);
        res.headers.set('Cache-Control', 'no-store');
        return res;
    }
    const res = NextResponse.redirect(new URL('/login?session=stale', origin));
    for (const name of SESSION_COOKIES) expire(res, name);
    expire(res, IMPERSONATION_COOKIE);
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
