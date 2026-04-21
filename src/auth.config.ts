import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        // Always allow the request through — our middleware (middleware.ts, Branches A/B/C)
        // handles all authorization, rate-limiting, and routing. Without this callback,
        // NextAuth v5 defaults to `authorized: ({ auth }) => !!auth` which would redirect
        // every unauthenticated visitor (including coral-sys storefront users) to /login.
        authorized: () => true,
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as { role?: string }).role;
                token.id = user.id;
                token.tenantId = (user as { tenantId?: string | null }).tenantId;
                token.emailVerified = !!(user as unknown as { emailVerified?: Date | null }).emailVerified;
                token.environmentLanguage = (user as { environmentLanguage?: string | null }).environmentLanguage;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { role?: string }).role = token.role as string;
                session.user.id = token.id as string;
                (session.user as { tenantId?: string | null }).tenantId = token.tenantId as string | null;
                (session.user as unknown as { emailVerified?: boolean }).emailVerified = token.emailVerified as boolean;
                (session.user as unknown as { environmentLanguage?: string | null }).environmentLanguage = token.environmentLanguage as string | null;
            }
            return session;
        }
    },
    providers: [], // Add providers with an empty array for edge compatibility
    session: {
        strategy: "jwt",
        // OWASP-compliant session timeouts for SaaS:
        // - maxAge: 8 hours → sets the JWT exp claim (absolute timeout while browser is open)
        // - updateAge: 30 minutes → token is only re-issued every 30 min (idle-refresh window)
        // The cookie itself is a SESSION COOKIE (see `cookies` block below) — no Max-Age/Expires
        // attribute, so the browser deletes it the moment all windows are closed.
        maxAge: 8 * 60 * 60,    // 8 h absolute (JWT exp claim only, not on cookie)
        updateAge: 30 * 60,     // 30 min idle refresh
    },
    // ── Session cookie: deleted on browser close ─────────────────────────────
    // Omitting maxAge/expires from the cookie options strips those attributes
    // from the Set-Cookie header. Browsers treat such cookies as session cookies
    // and discard them when the window/tab context is fully closed.
    // The JWT exp claim (8 h above) still enforces the absolute timeout while
    // the browser remains open.
    cookies: {
        sessionToken: {
            options: {
                httpOnly: true,
                sameSite: 'lax' as const,
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                // ← no maxAge here → session cookie
            },
        },
    },
    secret: process.env.AUTH_SECRET || "coral-secret-12345",
    // Trust host headers forwarded by Vercel so Auth.js accepts requests from
    // ALL subdomains (coral-sys, app, coral-group.be), not just NEXTAUTH_URL.
    trustHost: true,
} satisfies NextAuthConfig;
