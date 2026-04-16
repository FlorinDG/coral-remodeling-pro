import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import type { NextRequest } from 'next/server';

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
    const role = (req.auth?.user as any)?.role;

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
    // Fully public. Rewrite root + any non-specific path → /[locale]/store
    // ══════════════════════════════════════════════════════════════════════
    if (isStoreSubdomain) {
        const locale = resolveLocale(req);

        // Paths that should be served as-is (already locale-prefixed store, or public pages)
        const passthrough = ['/store', '/help', '/terms', '/privacy', '/login', '/_next', '/api'];
        const isPassthrough = passthrough.some(p => pathname.includes(p));

        // If already has a locale prefix and is a passthrough path, just proxy it
        if (isPassthrough && hasLocalePrefix(pathname)) {
            const res = NextResponse.next();
            Object.entries(noCache()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        // Extract path past locale prefix, or treat full pathname as "rest"
        let targetLocale = locale;
        let rest = '';

        if (hasLocalePrefix(pathname)) {
            const parts = pathname.split('/');
            targetLocale = parts[1];
            rest = parts.slice(2).join('/');
        } else {
            rest = pathname.replace(/^\//, '');
        }

        // Determine target path
        const isAlreadyStore = rest.startsWith('store');
        const isPublicPath   = ['help','terms','privacy','login'].some(p => rest.startsWith(p));
        const targetPath = isAlreadyStore || isPublicPath
            ? `/${targetLocale}/${rest}`
            : `/${targetLocale}/store`;

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
                const url = new URL('/nl/login', req.nextUrl.origin);
                return NextResponse.redirect(url);
            }
            if (role !== "SUPERADMIN") {
                const url = new URL('/nl/admin', req.nextUrl.origin);
                return NextResponse.redirect(url);
            }
        }

        // ── Admin / Portal protection ──
        const isProtectedPath  = virtualPath.startsWith('/admin') || virtualPath.startsWith('/portal');
        const isTimeTrackerPath = virtualPath.includes('/admin/time-tracker');

        if (isProtectedPath && !isLoginPage && !isPublicPage && !isTimeTrackerPath && !isLoggedIn) {
            const url = new URL('/nl/login', req.nextUrl.origin);
            return NextResponse.redirect(url);
        }

        // ── Locale auto-correction for authenticated admin users ──
        const cookieLang = req.cookies.get('NEXT_LOCALE')?.value;
        const jwtLang    = (req.auth?.user as any)?.environmentLanguage;
        const userLang   = (cookieLang && SUPPORTED_LOCALES.includes(cookieLang)) ? cookieLang
            : (jwtLang && SUPPORTED_LOCALES.includes(jwtLang)) ? jwtLang
            : null;

        if (isLoggedIn && virtualPath.startsWith('/admin') && userLang) {
            const localeMatch  = pathname.match(/^\/(en|fr|nl|ro|ru)(\/|$)/);
            const currentLocale = localeMatch?.[1];
            if (currentLocale && currentLocale !== userLang) {
                const corrected = new URL(
                    pathname.replace(/^\/(en|fr|nl|ro|ru)/, `/${userLang}`),
                    req.nextUrl.origin
                );
                corrected.search = req.nextUrl.search;
                return NextResponse.redirect(corrected);
            }
        }

        // ── Rewrite: map root/non-admin paths → /[locale]/admin ──
        const locale = resolveLocale(req);

        // Paths that should pass through as-is (already have correct prefix)
        const noRewriteSegs = ['admin', 'superadmin', 'login', 'help', 'terms', 'privacy', 'portal', 'store', '_next', 'api'];
        let rewriteTarget: string | null = null;

        if (hasLocalePrefix(pathname)) {
            const parts = pathname.split('/');
            const locSeg = parts[1];
            const rest   = parts.slice(2).join('/');
            if (!noRewriteSegs.some(s => rest.startsWith(s))) {
                rewriteTarget = `/${locSeg}/admin${rest ? `/${rest}` : ''}`;
            }
        } else {
            const rest = pathname.replace(/^\//, '');
            if (!noRewriteSegs.some(s => rest.startsWith(s))) {
                rewriteTarget = `/${locale}/admin${rest ? `/${rest}` : ''}`;
            }
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
