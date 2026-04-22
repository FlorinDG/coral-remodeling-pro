import { decode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { PLATFORM_ADMIN_ROLES } from '@/lib/roles';

// ── Types ──────────────────────────────────────────────────────────────────
type DecodedToken = {
    role?: string;
    environmentLanguage?: string;
    activeModules?: string[];
    email?: string;
    sub?: string;
    exp?: number;
};

// ── Constants ──────────────────────────────────────────────────────────────
const SUPPORTED_LOCALES = routing.locales as readonly string[];
const DEFAULT_LOCALE    = routing.defaultLocale as string;
const AUTH_SECRET       = process.env.AUTH_SECRET ?? 'coral-secret-12345';

// Cookie name differs by environment (Auth.js v5 default naming)
const SESSION_COOKIE = process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

const intlMiddleware = createMiddleware(routing);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decode the Auth.js v5 JWT from the session cookie — Edge-runtime safe. */
async function getToken(req: NextRequest): Promise<DecodedToken | null> {
    const raw = req.cookies.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    try {
        const token = await decode({
            token:  raw,
            secret: AUTH_SECRET,
            salt:   SESSION_COOKIE,
        }) as DecodedToken | null;
        // Reject expired tokens
        if (!token || (token.exp && token.exp * 1000 < Date.now())) return null;
        return token;
    } catch {
        return null;
    }
}

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

/** True when pathname already has a locale segment (e.g. /nl/store) */
function hasLocalePrefix(pathname: string): boolean {
    const seg = pathname.split('/')[1];
    return SUPPORTED_LOCALES.includes(seg);
}

/**
 * Domain Routing Rules (single Vercel deployment, 3 domains):
 *
 *  www.coral-group.be / coral-group.be  → Construction company site  (Branch C)
 *  coral-sys.coral-group.be             → CoralOS SaaS storefront     (Branch A)
 *  app.coral-group.be                   → CoralOS ERP                 (Branch B)
 *
 * We use NextResponse.rewrite() directly for subdomain routing.
 */
export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const hostname = req.nextUrl.hostname || '';

    const isStoreSubdomain = hostname === 'coral-sys.coral-group.be' || hostname.startsWith('coral-sys.');
    const isAppSubdomain   = hostname === 'app.coral-group.be'       || hostname.startsWith('app.');

    // No-cache headers for all subdomain responses
    const noCache = () => ({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma':        'no-cache',
        'Surrogate-Control': 'no-store',
    });

    // ══════════════════════════════════════════════════════════════════════
    // BRANCH A: coral-sys.coral-group.be → CoralOS SaaS storefront
    // Fully public — no auth check whatsoever.
    // Everything that isn't a Next.js internal → /[locale]/store
    // ══════════════════════════════════════════════════════════════════════
    if (isStoreSubdomain) {
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
        // Decode session once — used throughout Branch B
        const token     = await getToken(req);
        const isLoggedIn = !!token;
        const role       = token?.role;

        const isLoginPage  = pathname.includes('/login');
        const isPublicPage = pathname.includes('/help') || pathname.includes('/terms') || pathname.includes('/privacy');

        // Virtualise path for auth checks
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
                const url = new URL('/admin', req.nextUrl.origin);
                return NextResponse.redirect(url);
            }
        }

        // ── Admin / Portal protection ──
        const isProtectedPath   = virtualPath.startsWith('/admin') || virtualPath.startsWith('/portal');
        const isTimeTrackerPath = virtualPath.includes('/admin/time-tracker');

        if (isProtectedPath && !isLoginPage && !isPublicPage && !isTimeTrackerPath && !isLoggedIn) {
            const url = new URL('/login', req.nextUrl.origin);
            return NextResponse.redirect(url);
        }

        // ── Module-based route gating ─────────────────────────────────────
        const activeModules = token?.activeModules;
        const isSuperadmin  = PLATFORM_ADMIN_ROLES.includes(role as (typeof PLATFORM_ADMIN_ROLES)[number]);

        const MODULE_GATE: Record<string, string> = {
            'financials':          'INVOICING',
            'quotations':          'INVOICING',
            'suppliers':           'INVOICING',
            'projects-management': 'PROJECTS',
            'hr':                  'HR',
            'calendar':            'CALENDAR',
            'websites':            'WEBSITES',
            'databases':           'DATABASES',
            'library':             'INVOICING',
            'tasks':               'TASKS',
            'email':               'EMAIL',
        };

        if (isLoggedIn && !isSuperadmin && activeModules) {
            const stripped = pathname.replace(/^\/(en|fr|nl|ro|ru)/, '').replace(/^\/admin\/?/, '');
            const segment  = stripped.split('/')[0];
            const requiredModule = MODULE_GATE[segment];
            if (requiredModule && !activeModules.includes(requiredModule)) {
                const locale  = resolveLocale(req);
                const blocked = new URL(`/${locale}/admin?blocked=${requiredModule}`, req.nextUrl.origin);
                return NextResponse.redirect(blocked);
            }
        }

        // ── Sync NEXT_LOCALE cookie from JWT language preference ──────────
        // NOTE: We no longer short-circuit here. Instead we set `pendingLocale`
        // and apply the cookie to whichever response the rest of the middleware
        // produces (rewrite or intl). The old code returned NextResponse.next()
        // immediately, which skipped the locale-prefix rewrite and caused 404s
        // on the very first request after login.
        const jwtLang = token?.environmentLanguage;
        let pendingLocaleCookie: string | null = null;
        if (isLoggedIn && jwtLang && SUPPORTED_LOCALES.includes(jwtLang)) {
            const cookieLang = req.cookies.get('NEXT_LOCALE')?.value;
            if (cookieLang !== jwtLang) {
                pendingLocaleCookie = jwtLang;
            }
        }

        // ── Rewrite: map root / non-admin paths → /[locale]/admin ─────────
        const locale = pendingLocaleCookie || resolveLocale(req);
        const noRewriteSegs = ['admin', 'superadmin', 'login', 'help', 'terms', 'privacy', 'portal', 'store', 'reset-password', '_next', 'api'];
        const rest = pathname.replace(/^\//, '');
        let rewriteTarget: string | null = null;

        if (!noRewriteSegs.some(s => rest.startsWith(s))) {
            rewriteTarget = `/${locale}/admin${rest ? `/${rest}` : ''}`;
        }

        /** Apply pending locale cookie + no-cache headers to any response */
        const applyHeaders = (res: NextResponse) => {
            if (pendingLocaleCookie) {
                res.cookies.set('NEXT_LOCALE', pendingLocaleCookie, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
            }
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        };

        if (rewriteTarget) {
            const rewriteUrl = new URL(rewriteTarget, req.nextUrl.origin);
            return applyHeaders(NextResponse.rewrite(rewriteUrl));
        }

        // Path already correctly prefixed — add no-cache and let intl handle it
        return applyHeaders(intlMiddleware(req));
    }

    // ══════════════════════════════════════════════════════════════════════
    // BRANCH C: www.coral-group.be / coral-group.be → Construction site
    // ══════════════════════════════════════════════════════════════════════
    return intlMiddleware(req);
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|images|branding|sitemap.xml|robots.txt|favicon.ico|manifest.json|sw.js).*)'],
};
