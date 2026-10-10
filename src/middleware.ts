import { decode } from 'next-auth/jwt';
import { NextResponse, NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { PLATFORM_ADMIN_ROLES } from '@/lib/roles';
import { authSecretOf } from '@/lib/auth-secret';
import en from './messages/en.json';
import nl from './messages/nl.json';
import fr from './messages/fr.json';
import ro from './messages/ro.json';

// ── Types ──────────────────────────────────────────────────────────────────
type DecodedToken = {
    role?: string;
    environmentLanguage?: string;
    activeModules?: string[];
    email?: string;
    sub?: string;
    exp?: number;
    planType?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────
const SUPPORTED_LOCALES = routing.locales as readonly string[];
const DEFAULT_LOCALE    = routing.defaultLocale as string;
// AUTH-SECRET-1: no default — without a secret no session is decoded and every page shows the notice below.
const AUTH_SECRET       = authSecretOf(process.env.AUTH_SECRET);

// Cookie name differs by environment (Auth.js v5 default naming)
const SESSION_COOKIE = process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

const intlMiddleware = createMiddleware(routing);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decode the Auth.js v5 JWT from the session cookie — Edge-runtime safe. */
async function getToken(req: NextRequest): Promise<DecodedToken | null> {
    const raw = req.cookies.get(SESSION_COOKIE)?.value;
    if (!raw || !AUTH_SECRET) return null;
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

function isMobileUserAgent(ua: string): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function getMobileEquivalent(normalisedPath: string): string | null {
    if (normalisedPath === '/admin' || normalisedPath === '/admin/dashboard') {
        return '/m';
    }
    if (normalisedPath === '/admin/financials/income/invoices') {
        return '/m/invoices';
    }
    if (normalisedPath === '/admin/financials/income/invoices/new') {
        return '/m/invoices/new';
    }
    if (normalisedPath.startsWith('/admin/financials/income/invoices/')) {
        const id = normalisedPath.substring('/admin/financials/income/invoices/'.length);
        return `/m/invoices/${id}`;
    }
    if (normalisedPath.startsWith('/admin/financials/expense/expenses')) {
        return '/m/expenses';
    }
    if (normalisedPath.startsWith('/admin/contacts')) {
        return '/m/clients';
    }
    if (normalisedPath.startsWith('/admin/quotations')) {
        return '/m/quotes';
    }
    if (normalisedPath.startsWith('/admin/suppliers')) {
        return '/m/purchases';
    }
    if (normalisedPath.startsWith('/admin/settings')) {
        return '/m/settings';
    }
    return null;
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
const NOT_CONFIGURED: Record<string, { title: string; body: string }> = {
    en: en.System.authNotConfigured, nl: nl.System.authNotConfigured,
    fr: fr.System.authNotConfigured, ro: ro.System.authNotConfigured,
};

/** AUTH-SECRET-1 · nothing moves forward without the secret: one plain page, in the visitor's language, status 503. */
function authNotConfigured(req: NextRequest): NextResponse {
    const { title, body } = NOT_CONFIGURED[resolveLocale(req)] ?? NOT_CONFIGURED[DEFAULT_LOCALE];
    console.error('[auth] AUTH_SECRET is not set — every page shows the not-configured notice');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>`
        + `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fafafa;color:#18181b;font:15px/1.5 system-ui,sans-serif}`
        + `main{max-width:440px;margin:16px;padding:32px;background:#fff;border:1px solid #e4e4e7;border-radius:12px}`
        + `h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#52525b}`
        + `@media (prefers-color-scheme:dark){body{background:#09090b;color:#fafafa}main{background:#18181b;border-color:#27272a}p{color:#a1a1aa}}</style>`
        + `</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
    return new NextResponse(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async function middleware(req: NextRequest) {
    if (!AUTH_SECRET) return authNotConfigured(req);
    const { pathname } = req.nextUrl;
    const hostname = req.nextUrl.hostname || '';

    const isStoreSubdomain = hostname === 'coral-sys.coral-group.be' || hostname.startsWith('coral-sys.');
    const isAppSubdomain   = hostname === 'app.coral-group.be'       || hostname.startsWith('app.') || hostname.includes('localhost') || hostname.includes('.vercel.app');
    const isWorkSubdomain  = hostname === 'work.coral-group.be'      || hostname.startsWith('work.');

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
    // BRANCH W: work.coral-group.be → WorkHub Standalone Workforce App
    // Auth-protected — rewrites all paths to /[locale]/workhub/*
    // ══════════════════════════════════════════════════════════════════════
    if (isWorkSubdomain) {
        // Let API calls and static assets through
        if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
            const res = NextResponse.next();
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        const token = await getToken(req);
        const isLoggedIn = !!token;
        const locale = resolveLocale(req);

        // Branch W (WorkHub subdomain): FREE mobile -> redirect to app subdomain /m
        const userAgent = req.headers.get('user-agent') || '';
        const isMobile = isMobileUserAgent(userAgent);
        if (isLoggedIn && token?.planType === 'FREE' && isMobile && req.cookies.get('desktop-view')?.value !== 'true') {
            const appHostname = hostname.replace(/^work\./, 'app.');
            const appUrl = new URL(`/${locale}/m`, `${req.nextUrl.protocol}//${appHostname}`);
            const res = NextResponse.redirect(appUrl);
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        const isLoginPage = pathname.includes('/login');
        const isPublicPage = pathname.includes('/help') || pathname.includes('/terms') || pathname.includes('/privacy') || pathname.includes('/accept-invite') || pathname.includes('/quote/') || pathname.includes('/invoice/');

        // Redirect to login if not authenticated
        if (!isLoggedIn && !isLoginPage && !isPublicPage) {
            const loginUrl = new URL(`/${locale}/login`, req.nextUrl.origin);
            loginUrl.searchParams.set('callbackUrl', pathname);
            const res = NextResponse.redirect(loginUrl);
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        // ── Check if tenant is allowed on workhub (Enterprise / Workforce / HR) ──
        if (isLoggedIn && !isLoginPage && !isPublicPage) {
            const isSuperadmin = PLATFORM_ADMIN_ROLES.includes(token.role as (typeof PLATFORM_ADMIN_ROLES)[number]);
            const hasAccess = isSuperadmin || token?.activeModules?.includes('HR');
            
            if (!hasAccess) {
                // Not allowed in workhub -> redirect back to app. subdomain
                // e.g. work.coral-group.be -> app.coral-group.be
                const appHostname = hostname.replace(/^work\./, 'app.');
                const appUrl = new URL(`/${locale}/admin`, `${req.nextUrl.protocol}//${appHostname}`);
                const res = NextResponse.redirect(appUrl);
                Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
                return res;
            }
        }

        // Login, help, terms, privacy — serve normally via intl middleware
        if (isLoginPage || isPublicPage) {
            const res = intlMiddleware(req);
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        // Rewrite everything else → /[locale]/workhub/*
        let rest = pathname.replace(/^\/(en|fr|nl|ro|ru)/, '').replace(/^\//, '');
        // If they're already on /workhub, strip it to avoid /workhub/workhub
        if (rest.startsWith('workhub')) {
            rest = rest.replace(/^workhub\/?/, '');
        }
        const targetPath = `/${locale}/workhub${rest ? `/${rest}` : ''}`;
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
        const planType   = token?.planType;

        const strippedPath = hasLocalePrefix(pathname)
            ? pathname.replace(/^\/(en|fr|nl|ro|ru)/, '')
            : pathname;

        const userAgent = req.headers.get('user-agent') || '';
        const isMobile = isMobileUserAgent(userAgent);

        // Branch B (app subdomain): FREE mobile -> redirect to /m equivalents
        if (isLoggedIn && planType === 'FREE' && isMobile && req.cookies.get('desktop-view')?.value !== 'true') {
            const mobileTarget = getMobileEquivalent(strippedPath);
            if (mobileTarget) {
                const locale = resolveLocale(req);
                const redirectUrl = new URL(`/${locale}${mobileTarget}`, req.nextUrl.origin);
                const res = NextResponse.redirect(redirectUrl);
                Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
                return res;
            }
        }

        const isLoginPage  = pathname.includes('/login');
        const isPublicPage = pathname.includes('/help') || pathname.includes('/terms') || pathname.includes('/privacy') || pathname.includes('/accept-invite') || pathname.includes('/reset-password') || pathname.includes('/quote/') || pathname.includes('/invoice/');

        // Clone and inject x-pathname header
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-pathname', pathname);

        // Virtualise path for auth checks
        const virtualPath = !pathname.startsWith('/admin') && !pathname.startsWith('/portal') && !pathname.startsWith('/superadmin') && !pathname.startsWith('/workhub')
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

        // ── Admin / Portal / WorkHub protection ──
        const isProtectedPath   = virtualPath.startsWith('/admin') || virtualPath.startsWith('/portal') || pathname.startsWith('/workhub');
        const isTimeTrackerPath = virtualPath.includes('/admin/time-tracker');

        if (isProtectedPath && !isLoginPage && !isPublicPage && !isTimeTrackerPath && !isLoggedIn) {
            const loginUrl = new URL('/login', req.nextUrl.origin);
            loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
            return NextResponse.redirect(loginUrl);
        }

        // ── Module-based route gating ─────────────────────────────────────
        const activeModules = token?.activeModules;
        const isSuperadmin  = PLATFORM_ADMIN_ROLES.includes(role as (typeof PLATFORM_ADMIN_ROLES)[number]);

        const MODULE_GATE: Record<string, string> = {
            'financials':          'INVOICING',
            'quotations':          'INVOICING',
            'suppliers':           'INVOICING',
            'projects-management': 'PROJECTS',
            'portals':             'PROJECTS',
            'hr':                  'HR',
            'calendar':            'CALENDAR',
            'websites':            'WEBSITES',
            'databases':           'DATABASES',
            'library':             'INVOICING',
            'tasks':               'TASKS',
            'email':               'EMAIL',
            'workhub':             'HR',
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

        // ── Specialist role route hard gates ─────────────────────────────────
        // Mirrors the sidebar allow-lists in AdminLayout — middleware is the real guard.
        // Specialist users who navigate directly to restricted routes are redirected.
        const ROLE_ROUTE_ALLOWLISTS: Partial<Record<string, string[]>> = {
            ACCOUNTANT:      ['/admin/dashboard', '/admin/journal', '/admin/financials', '/admin/contacts', '/admin/suppliers', '/admin/quotations', '/admin/settings'],
            OFFERTES:        ['/admin/quotations', '/admin/contacts', '/admin/library', '/admin/projects-management', '/admin/settings', '/admin/dashboard', '/admin/journal'],
            BOOKKEEPING:     ['/admin/financials', '/admin/contacts', '/admin/suppliers', '/admin/library', '/admin/settings', '/admin/dashboard', '/admin/journal'],
            HR_OFFICER:      ['/admin/hr', '/admin/settings', '/admin/dashboard'],
            TEAMLEAD:        ['/admin/projects-management', '/admin/tasks', '/admin/calendar', '/admin/hr', '/admin/settings', '/admin/dashboard', '/admin/journal'],
            PROJECT_MANAGER: ['/admin/projects-management', '/admin/tasks', '/admin/calendar', '/admin/contacts', '/admin/settings', '/admin/dashboard', '/admin/journal'],
            TENANT_ENTERPRISE_WORKFORCE: ['/workhub'],
            crew:            ['/workhub'],
        };
        const roleAllowList = ROLE_ROUTE_ALLOWLISTS[role ?? ''];
        if (roleAllowList && isLoggedIn) {
            // Strip locale prefix for consistent comparison
            const normalised = pathname.replace(/^\/(en|fr|nl|ro|ru)/, '');
            const allowed = roleAllowList.some(r => normalised === r || normalised.startsWith(r + '/'));
            if (!allowed && normalised.startsWith('/admin')) {
                const locale  = resolveLocale(req);
                const landing = roleAllowList[0] ?? '/admin/dashboard';
                return NextResponse.redirect(new URL(`/${locale}${landing}`, req.nextUrl.origin));
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
        const noRewriteSegs = ['admin', 'superadmin', 'login', 'help', 'terms', 'privacy', 'portal', 'store', 'reset-password', 'accept-invite', 'workhub', 'm', '_next', 'api', 'quote', 'invoice'];
        const rest = strippedPath.replace(/^\//, '');
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
            return applyHeaders(NextResponse.rewrite(rewriteUrl, {
                request: { headers: requestHeaders }
            }));
        }

        // Path already correctly prefixed — add no-cache and let intl handle it
        const modifiedReq = new NextRequest(req, {
            headers: requestHeaders,
        });
        return applyHeaders(intlMiddleware(modifiedReq));
    }

    // ══════════════════════════════════════════════════════════════════════
    // BRANCH C: www.coral-group.be / coral-group.be → Construction site
    // ══════════════════════════════════════════════════════════════════════
    return intlMiddleware(req);
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|images|fonts|branding|sitemap.xml|robots.txt|favicon.ico|icon.svg|apple-touch-icon.png|manifest.json|manifest-workhub.json|manifest-mobile.json|sw.js|sw-workhub.js).*)'],
};
