import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const SUPPORTED_LOCALES = routing.locales as readonly string[];

const intlMiddleware = createMiddleware(routing);

const { auth } = NextAuth(authConfig);

/**
 * Domain Routing Rules (single Vercel deployment, 3 domains):
 *
 *  coral-group.be              → Construction company presentation site
 *                                Serves: /[locale]/page.tsx (Hero, Services, Projects)
 *                                No auth required.
 *
 *  coral-sys.coral-group.be    → CoralOS SaaS marketing / front-store
 *                                Rewrites: / → /[locale]/store
 *                                Fully public. No auth required.
 *
 *  app.coral-group.be          → CoralOS ERP application
 *                                Rewrites: / → /[locale]/admin
 *                                Auth required for /admin and /portal routes.
 *                                SUPERADMIN users can also access /superadmin from here.
 */

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { pathname } = req.nextUrl;
    const role = (req.auth?.user as any)?.role;

    // ── Host detection ───────────────────────────────────────────────────────
    // On Vercel Edge, req.nextUrl.hostname is always the actual request hostname.
    // req.headers.get("host") can be unreliable behind the Vercel proxy.
    // We use nextUrl.hostname as primary, with header fallbacks for completeness.
    const hostname = req.nextUrl.hostname
        || req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
        || req.headers.get("host")?.split(":")[0]
        || "";

    // ── Domain classification ────────────────────────────────────────────────
    const isStoreSubdomain = hostname.startsWith("coral-sys.");     // CoralOS storefront
    const isAppSubdomain   = hostname.startsWith("app.");           // CoralOS ERP
    // Everything else (www.coral-group.be, coral-group.be, localhost, preview) → main site


    // ── Public path classification ───────────────────────────────────────────
    const isLoginPage  = pathname.includes("/login");
    const isPublicPage = pathname.includes("/help") ||
                         pathname.includes("/terms") ||
                         pathname.includes("/privacy") ||
                         pathname.includes("/store");

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH A: coral-sys.coral-group.be → CoralOS public storefront
    // Fully public — no auth, no redirects, just rewrite to /store
    // ════════════════════════════════════════════════════════════════════════
    if (isStoreSubdomain) {
        const intlResponse = intlMiddleware(req);

        // Apply rewrite: any path on coral-sys → /[locale]/store
        const rewriteUrl = intlResponse.headers.get('x-middleware-rewrite');
        if (rewriteUrl && intlResponse.status === 200) {
            const url = new URL(rewriteUrl);
            const parts = url.pathname.split('/');
            const locale = parts[1]; // e.g. 'nl'
            const rest = parts.slice(2).join('/');

            // Only rewrite if not already on /store, /login, /help, /terms
            const noRewritePaths = ['store', 'login', 'help', 'terms', 'privacy'];
            if (!noRewritePaths.some(p => rest.startsWith(p))) {
                url.pathname = `/${locale}/store`;
                intlResponse.headers.set('x-middleware-rewrite', url.toString());
            }
        }

        // No caching for SaaS subdomain
        intlResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        intlResponse.headers.set('Pragma', 'no-cache');

        return intlResponse;
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH B: app.coral-group.be → CoralOS ERP
    // ════════════════════════════════════════════════════════════════════════
    if (isAppSubdomain) {
        // Compute virtual path to apply protection BEFORE rewriting
        const virtualPath = !pathname.startsWith('/admin') && !pathname.startsWith('/portal') && !pathname.startsWith('/superadmin')
            ? `/admin${pathname === '/' ? '' : pathname}`
            : pathname;

        // ── Superadmin protection ──
        // /superadmin is accessible from app subdomain for SUPERADMIN role only
        const isSuperadminPath = virtualPath.startsWith('/superadmin') || pathname.includes('/superadmin');
        if (isSuperadminPath && !isLoginPage && !isPublicPage) {
            if (!isLoggedIn) {
                const loginUrl = new URL(req.nextUrl.href);
                loginUrl.pathname = '/nl/login';
                return NextResponse.redirect(loginUrl);
            }
            if (role !== "SUPERADMIN") {
                const fallbackUrl = new URL(req.nextUrl.href);
                fallbackUrl.pathname = '/nl/admin';
                return NextResponse.redirect(fallbackUrl);
            }
        }

        // ── Admin / Portal protection ──
        const isProtectedPath = virtualPath.startsWith('/admin') || virtualPath.startsWith('/portal');
        const isTimeTrackerPath = virtualPath.includes('/admin/time-tracker');

        if (isProtectedPath && !isLoginPage && !isPublicPage && !isTimeTrackerPath && !isLoggedIn) {
            const loginUrl = new URL(req.nextUrl.href);
            loginUrl.pathname = '/nl/login';
            return NextResponse.redirect(loginUrl);
        }

        // ── Locale auto-correction for authenticated admin users ──
        const cookieLang = req.cookies.get('NEXT_LOCALE')?.value;
        const jwtLang = (req.auth?.user as any)?.environmentLanguage;
        const userLang = (cookieLang && SUPPORTED_LOCALES.includes(cookieLang)) ? cookieLang
            : (jwtLang && SUPPORTED_LOCALES.includes(jwtLang)) ? jwtLang
            : null;
        const isAdminPath = virtualPath.startsWith('/admin');

        if (isLoggedIn && isAdminPath && userLang) {
            const localeMatch = pathname.match(/^\/(en|fr|nl|ro|ru)(\/|$)/);
            const currentLocale = localeMatch?.[1];
            if (currentLocale && currentLocale !== userLang) {
                const correctedPath = pathname.replace(/^\/(en|fr|nl|ro|ru)/, `/${userLang}`);
                const redirectUrl = new URL(correctedPath, req.nextUrl.origin);
                redirectUrl.search = req.nextUrl.search;
                return NextResponse.redirect(redirectUrl);
            }
        }

        // ── Pass to next-intl ──
        const intlResponse = intlMiddleware(req);
        if (intlResponse.status !== 200) {
            intlResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            return intlResponse;
        }

        // ── Rewrite: / → /[locale]/admin ──
        const rewriteUrl = intlResponse.headers.get('x-middleware-rewrite');
        if (rewriteUrl) {
            const url = new URL(rewriteUrl);
            const parts = url.pathname.split('/');
            const locale = parts[1];
            const rest = parts.slice(2).join('/');

            // Don't touch paths that are already admin, superadmin, login, or public pages
            const noRewritePaths = ['admin', 'superadmin', 'login', 'help', 'terms', 'privacy', 'portal', 'store'];
            if (!noRewritePaths.some(p => rest.startsWith(p))) {
                url.pathname = `/${locale}/admin${rest ? `/${rest}` : ''}`;
                intlResponse.headers.set('x-middleware-rewrite', url.toString());
            }
        }

        // Prevent stale content across domain contexts
        intlResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        intlResponse.headers.set('Pragma', 'no-cache');

        return intlResponse;
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH C: coral-group.be → Construction company presentation site
    // No rewrites needed. next-intl handles locale prefix and redirection.
    // ════════════════════════════════════════════════════════════════════════
    return intlMiddleware(req);
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|images|branding|sitemap.xml|robots.txt|favicon.ico|manifest.json|sw.js).*)"],
}
