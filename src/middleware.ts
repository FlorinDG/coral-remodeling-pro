import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Typed shape of extra fields we add to the NextAuth JWT/session user.
type ExtendedUser = {
    role?: string;
    environmentLanguage?: string;
    activeModules?: string[];
};
import type { NextRequest } from 'next/server';
import { PLATFORM_ADMIN_ROLES } from '@/lib/roles';

const SUPPORTED_LOCALES = routing.locales as readonly string[];
const DEFAULT_LOCALE = routing.defaultLocale as string;

const intlMiddleware = createMiddleware(routing);

const { auth } = NextAuth(authConfig);

/**
 * Domain Routing Rules (single Vercel deployment, 3 domains):
 *
 *  www.coral-group.be / coral-group.be  → Construction company site
 *  coral-sys.coral-group.be             → CoralOS SaaS storefront (/[locale]/store)
 *  app.coral-group.be                   → CoralOS ERP (/[locale]/admin)
 *
 * KEY: We use NextResponse.rewrite() directly for subdomain routing.
 * Mutating x-middleware-rewrite on next-intl's response does NOT work in Next.js 15.
 */

/** Extract locale from request: cookie → accept-language → default */
function resolveLocale(req: NextRequest): string {
    const cookieLang = req.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLang && SUPPORTED_LOCALES.includes(cookieLang)) return cookieLang;

    const accept = req.headers.get('accept-language') || '';
    for (const part of accept.split(',')) {
        const lang = part.split(';')[0].trim().slice(0, 2).toLowerCase();
        if (SUPPORTED_LOCALES.includes(lang)) return lang;
    }
    return DEFAULT_LOCALE;
}

/** Check if pathname already has a locale prefix */
function hasLocalePrefix(pathname: string): boolean {
    const seg = pathname.split('/')[1];
    return SUPPORTED_LOCALES.includes(seg);
}

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { pathname } = req.nextUrl;
    const role = (req.auth?.user as ExtendedUser)?.role;

    // ── Host detection ──────────────────────────────────────────────────────
    // req.nextUrl.hostname is always correct on Vercel Edge.
    const hostname = req.nextUrl.hostname || "";

    // ── Domain classification ───────────────────────────────────────────────
    const isStoreSubdomain = hostname === "coral-sys.coral-group.be" || hostname.startsWith("coral-sys.");
    const isAppSubdomain   = hostname === "app.coral-group.be"       || hostname.startsWith("app.");

    // No-cache headers for all subdomain responses
    const noCache = () => ({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Surrogate-Control': 'no-store',
    });

    // ══════════════════════════════════════════════════════════════════════
    // BRANCH A: coral-sys.coral-group.be → CoralOS SaaS storefront
    // Fully public. Everything that isn't a Next.js internal → /[locale]/store
    // Login is NOT accessible here — always rewrite back to store.
    // ══════════════════════════════════════════════════════════════════════
    if (isStoreSubdomain) {
        // Next.js internals and API routes must pass through untouched
        if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
            const res = NextResponse.next();
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        const locale = resolveLocale(req);
        let targetLocale = locale;
        let rest = '';

        if (hasLocalePrefix(pathname)) {
            const parts = pathname.split('/');
            targetLocale = parts[1];
            rest = parts.slice(2).join('/');
        } else {
            rest = pathname.replace(/^\//, '');
        }

        // Only allow store, help, terms, privacy pages — anything else (incl. /login) → store
        const ALLOWED_STORE_PATHS = ['store', 'help', 'terms', 'privacy'];
        const isAllowedPath = ALLOWED_STORE_PATHS.some(p => rest.startsWith(p));
        const targetPath = isAllowedPath ? `/${targetLocale}/${rest}` : `/${targetLocale}/store`;

        const rewriteUrl = new URL(targetPath, req.nextUrl.origin);
        const res = NextResponse.rewrite(rewriteUrl);
        Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
        return res;
    }


    // ══════════════════════════════════════════════════════════════════════
    // BRANCH B: app.coral-group.be → CoralOS ERP
    // ══════════════════════════════════════════════════════════════════════
    if (isAppSubdomain) {
        const isLoginPage  = pathname.includes('/login');
        const isPublicPage = pathname.includes('/help') || pathname.includes('/terms') || pathname.includes('/privacy');

        // Virtualise path for auth checks (pretend we're already under /admin)
        const virtualPath = !pathname.startsWith('/admin') && !pathname.startsWith('/portal') && !pathname.startsWith('/superadmin')
            ? `/admin${pathname === '/' ? '' : pathname}`
            : pathname;

        // ── Superadmin protection ──
        const isSuperadminPath = virtualPath.startsWith('/superadmin') || pathname.includes('/superadmin');
        if (isSuperadminPath && !isLoginPage && !isPublicPage) {
            if (!isLoggedIn) {
                const loginUrl = new URL('/login', req.nextUrl.origin);
                loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
                return NextResponse.redirect(loginUrl);
            }
            if (!PLATFORM_ADMIN_ROLES.includes(role as (typeof PLATFORM_ADMIN_ROLES)[number])) {
                // Non-platform-admin (e.g. APP_MANAGER) → redirect to their ERP
                const url = new URL('/admin', req.nextUrl.origin);
                return NextResponse.redirect(url);
            }
        }

        // ── Admin / Portal protection ──
        const isProtectedPath  = virtualPath.startsWith('/admin') || virtualPath.startsWith('/portal');
        const isTimeTrackerPath = virtualPath.includes('/admin/time-tracker');

        if (isProtectedPath && !isLoginPage && !isPublicPage && !isTimeTrackerPath && !isLoggedIn) {
            const url = new URL('/login', req.nextUrl.origin);
            return NextResponse.redirect(url);
        }

        // ── Module-based route gating ────────────────────────────────────────
        // activeModules comes from the JWT (set at login, refreshed on updateAge).
        // This is enforced server-side — client-side UI bypass doesn't help.
        // Superadmin roles bypass all module gates.
        const activeModules = (req.auth?.user as ExtendedUser)?.activeModules;
        const isSuperadmin  = PLATFORM_ADMIN_ROLES.includes(role as (typeof PLATFORM_ADMIN_ROLES)[number]);

        // Map: path segment → required module
        const MODULE_GATE: Record<string, string> = {
            'financials':          'INVOICING',
            'quotations':          'INVOICING',
            'suppliers':           'INVOICING',
            'contacts':            'CRM',
            'projects-management': 'PROJECTS',
            'hr':                  'HR',
            'calendar':            'CALENDAR',
            'websites':            'WEBSITES',
            'databases':           'DATABASES',
            'library':             'INVOICING',
        };

        if (isLoggedIn && !isSuperadmin && activeModules) {
            // Strip locale prefix to get the admin sub-path
            // pathname examples: /nl/admin/financials/..., /admin/contacts
            const stripped = pathname.replace(/^\/(en|fr|nl|ro|ru)/, '').replace(/^\/admin\/?/, '');
            const segment  = stripped.split('/')[0];

            const requiredModule = MODULE_GATE[segment];
            if (requiredModule && !activeModules.includes(requiredModule)) {
                // Hard redirect — not a soft 403, so the user sees a clean dashboard
                const locale   = resolveLocale(req);
                const blocked  = new URL(`/${locale}/admin?blocked=${requiredModule}`, req.nextUrl.origin);
                return NextResponse.redirect(blocked);
            }
        }

        // ── Sync NEXT_LOCALE cookie from JWT language preference ──
        // With localePrefix: 'never', locale lives in the cookie, not the URL.
        // If the user's stored language differs from the current cookie, update it
        // so the next-intl middleware picks up the correct locale on the next request.
        const jwtLang = (req.auth?.user as { environmentLanguage?: string })?.environmentLanguage;
        if (isLoggedIn && jwtLang && SUPPORTED_LOCALES.includes(jwtLang)) {
            const cookieLang = req.cookies.get('NEXT_LOCALE')?.value;
            if (cookieLang !== jwtLang) {
                // Let the request proceed, but stamp the correct locale cookie.
                // The next page load will use the updated value.
                const syncRes = NextResponse.next();
                syncRes.cookies.set('NEXT_LOCALE', jwtLang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
                Object.entries(noCache()).forEach(([k, v]) => syncRes.headers.set(k, v));
                return syncRes;
            }
        }

        // ── Rewrite: map root / non-admin paths → /[locale]/admin ──
        // With localePrefix: 'never', paths never carry a locale segment in the URL.
        // intlMiddleware (called below) handles the internal /[locale]/* rewrite.
        const locale = resolveLocale(req);
        const noRewriteSegs = ['admin', 'superadmin', 'login', 'help', 'terms', 'privacy', 'portal', 'store', '_next', 'api'];
        let rewriteTarget: string | null = null;

        const rest = pathname.replace(/^\//, '');
        if (!noRewriteSegs.some(s => rest.startsWith(s))) {
            // Root or unknown path → send to /[locale]/admin
            rewriteTarget = `/${locale}/admin${rest ? `/${rest}` : ''}`;
        }

        if (rewriteTarget) {
            const rewriteUrl = new URL(rewriteTarget, req.nextUrl.origin);
            const res = NextResponse.rewrite(rewriteUrl);
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        // Path already correctly prefixed — just add no-cache and continue
        const intlRes = intlMiddleware(req);
        Object.entries(noCache()).forEach(([k, v]) => intlRes.headers.set(k, v));
        return intlRes;
    }

    // ══════════════════════════════════════════════════════════════════════
    // BRANCH C: www.coral-group.be / coral-group.be → Construction site
    // Let next-intl handle locale detection and redirection normally.
    // ══════════════════════════════════════════════════════════════════════
    return intlMiddleware(req);
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|images|branding|sitemap.xml|robots.txt|favicon.ico|manifest.json|sw.js).*)"],
}
