/**
 * Emergency Access Endpoint — SUPERADMIN RECOVERY ONLY
 *
 * Use when normal login is broken (auth stack failure, session corruption, etc.)
 * Completely bypasses NextAuth's authorize() flow. Creates a valid JWT session
 * directly from the owner account data stored in the database.
 *
 * Usage (browser):
 *   https://app.coral-group.be/api/emergency-access?token=YOUR_SECRET
 *
 * Required env var (set in Vercel dashboard — NOT in .env file):
 *   EMERGENCY_ACCESS_TOKEN=<your secret>
 *
 * Security:
 *   - Token compared with timing-safe equality (no timing attacks)
 *   - Endpoint returns 404 (not 401) if token is wrong — no enumeration
 *   - Disabled entirely if EMERGENCY_ACCESS_TOKEN is not set
 *   - Session expires in 8 hours (same as normal sessions)
 *   - All attempts are logged server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

const SESSION_COOKIE  = '__Secure-authjs.session-token';
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours — matches authConfig

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export async function GET(req: NextRequest) {
    const secret = process.env.EMERGENCY_ACCESS_TOKEN;
    if (!secret) {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const provided = req.nextUrl.searchParams.get('token') ?? '';
    if (!safeEqual(provided, secret)) {
        console.warn('[emergency-access] Invalid attempt from', req.headers.get('x-forwarded-for') ?? 'unknown');
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    // ── Find the platform owner account ─────────────────────────────────────
    const OWNER_TENANT_ID = process.env.OWNER_TENANT_ID ?? 'cmneyas2b0000veqvkgl2luz1';

    let user: { id: string; email: string | null; name: string | null; role: string | null; tenantId: string | null } | null = null;
    try {
        user = await prisma.user.findFirst({
            where:   { tenantId: OWNER_TENANT_ID },
            select:  { id: true, email: true, name: true, role: true, tenantId: true },
            orderBy: { id: 'asc' }, // cuid ordering — lowest id = earliest created
        });
    } catch (e) {
        console.error('[emergency-access] DB lookup failed:', e);
        return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
    }

    if (!user) {
        return NextResponse.json({ error: 'Owner account not found.' }, { status: 404 });
    }

    // ── Build a signed JWT identical to what NextAuth would issue ────────────
    const now = Math.floor(Date.now() / 1000);
    const jwtSecret = process.env.AUTH_SECRET ?? 'coral-secret-12345';

    let token: string;
    try {
        token = await encode({
            token: {
                sub:                 user.id,
                email:               user.email,
                name:                user.name,
                role:                user.role ?? 'SUPERADMIN',
                id:                  user.id,
                tenantId:            user.tenantId,
                environmentLanguage: 'nl',
                iat:                 now,
                exp:                 now + SESSION_MAX_AGE,
                jti:                 crypto.randomUUID(),
            },
            secret: jwtSecret,
            salt:   SESSION_COOKIE,
        });
    } catch (e) {
        console.error('[emergency-access] JWT encode failed:', e);
        return NextResponse.json({ error: 'Could not create session.' }, { status: 500 });
    }

    console.log('[emergency-access] Emergency session issued for', user.email);

    const res = NextResponse.redirect(new URL('/admin/dashboard', req.nextUrl.origin));
    res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure:   true,
        sameSite: 'lax',
        path:     '/',
        maxAge:   SESSION_MAX_AGE,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
