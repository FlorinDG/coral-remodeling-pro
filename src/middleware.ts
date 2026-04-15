import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const SUPPORTED_LOCALES = routing.locales as readonly string[];

const intlMiddleware = createMiddleware(routing);

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { pathname } = req.nextUrl
    const role = (req.auth?.user as any)?.role

    const host = req.headers.get("host") || "";
    const isSysSubdomain = host.startsWith("sys.") || host.startsWith("coral-sys.");
    const isAppSubdomain = host.startsWith("app.");

    // ── Route classification (used by ALL protection blocks below) ──
    const isLoginPage = pathname.includes("/login");
    const isPublicPage = pathname.includes("/help") || pathname.includes("/terms") || pathname.includes("/privacy");

    // Virtualize paths so we protect correctly BEFORE the rewrite actually occurs
    const virtualPath = isSysSubdomain && !pathname.startsWith('/superadmin')
        ? `/superadmin${pathname === '/' ? '' : pathname}`
        : isAppSubdomain && !pathname.startsWith('/admin')
            ? `/admin${pathname === '/' ? '' : pathname}`
            : pathname;

    // ── Superadmin protection (coral-sys.coral-group.be) ──
    // Skip login and public pages — those must remain accessible
    const isSuperadminPath = virtualPath.includes("/superadmin");
    if (isSuperadminPath && !isLoginPage && !isPublicPage) {
        if (!isLoggedIn) {
            // Stay on coral-sys domain — let next-intl handle locale prefix
            const loginUrl = new URL(req.nextUrl.href);
            loginUrl.pathname = '/login';
            return NextResponse.redirect(loginUrl);
        }
        if (role !== "SUPERADMIN") {
            const fallbackUrl = new URL(req.nextUrl.href);
            if (isSysSubdomain) {
                // Non-superadmin → send to the regular ERP
                fallbackUrl.hostname = fallbackUrl.hostname.replace(/^(coral-)?sys\./, 'app.');
                fallbackUrl.pathname = '/';
            } else {
                fallbackUrl.pathname = '/nl/admin';
            }
            return NextResponse.redirect(fallbackUrl);
        }
    }

    // ── Admin/Portal protection (app.coral-group.be) ──
    // Skip login, public pages, and time tracker (public feature)
    const isProtectedPath = virtualPath.includes("/admin") || virtualPath.includes("/portal");
    const isTimeTrackerPath = virtualPath.includes("/admin/time-tracker");

    if (isProtectedPath && !isLoginPage && !isPublicPage && !isTimeTrackerPath && !isLoggedIn) {
        const loginUrl = new URL(req.nextUrl.href);
        if (isAppSubdomain) {
            loginUrl.pathname = '/nl/login';
        } else {
            loginUrl.pathname = '/nl/admin/login';
        }
        return NextResponse.redirect(loginUrl)
    }

    // ── Locale auto-correction for authenticated admin users ──
    // Priority: NEXT_LOCALE cookie (set on save) > JWT environmentLanguage (set on login)
    const cookieLang = req.cookies.get('NEXT_LOCALE')?.value;
    const jwtLang = (req.auth?.user as any)?.environmentLanguage;
    const userLang = (cookieLang && SUPPORTED_LOCALES.includes(cookieLang)) ? cookieLang
        : (jwtLang && SUPPORTED_LOCALES.includes(jwtLang)) ? jwtLang
        : null;
    const isAdminPath = virtualPath.includes('/admin');

    if (isLoggedIn && isAdminPath && userLang) {
        // Extract current locale from URL: /fr/admin/... → fr
        const localeMatch = pathname.match(/^\/(en|fr|nl|ro|ru)(\/|$)/);
        const currentLocale = localeMatch?.[1];

        if (currentLocale && currentLocale !== userLang) {
            const correctedPath = pathname.replace(/^\/(en|fr|nl|ro|ru)/, `/${userLang}`);
            const redirectUrl = new URL(correctedPath, req.nextUrl.origin);
            redirectUrl.search = req.nextUrl.search;
            return NextResponse.redirect(redirectUrl);
        }
    }

    // Pass to next-intl to resolve localization
    const intlResponse = intlMiddleware(req);

    // If next-intl generated a redirect natively, bypass our rewrite engine and return
    if (intlResponse.status !== 200) {
        return intlResponse;
    }

    // ── Subdomain path rewrites ──
    // Rewrite paths so the same codebase serves different route trees per subdomain
    const rewriteUrl = intlResponse.headers.get('x-middleware-rewrite');

    if (rewriteUrl) {
        const url = new URL(rewriteUrl);
        let shouldRewrite = false;

        if (isSysSubdomain) {
            const parts = url.pathname.split('/');
            const locale = parts[1];
            const rest = parts.slice(2).join('/');

            // Don't rewrite login or public pages — they live at /[locale]/login, /[locale]/help etc.
            if (!rest.startsWith('superadmin') && !rest.startsWith('login') && !isPublicPage) {
                url.pathname = `/${locale}/superadmin${rest ? `/${rest}` : ''}`;
                shouldRewrite = true;
            }
        } else if (isAppSubdomain) {
            const parts = url.pathname.split('/');
            const locale = parts[1];
            const rest = parts.slice(2).join('/');

            // Don't rewrite login or public pages — they live at /[locale]/login, /[locale]/help etc.
            if (!rest.startsWith('admin') && !rest.startsWith('login') && !isPublicPage) {
                url.pathname = `/${locale}/admin${rest ? `/${rest}` : ''}`;
                shouldRewrite = true;
            }
        }

        // Finalize the subdomain mutation
        if (shouldRewrite) {
            intlResponse.headers.set('x-middleware-rewrite', url.toString());
        }
    }

    // ── Cache control for ERP subdomains ──
    // Prevent aggressive browser caching (esp. Arc) from serving stale content
    // across domain contexts. The main site (coral-group.be) can cache normally.
    if (isAppSubdomain || isSysSubdomain) {
        intlResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        intlResponse.headers.set('Pragma', 'no-cache');
    }

    return intlResponse;
})

export const config = {
    // Matcher for next-intl + next-auth
    // Skip all internal paths (_next) and static assets (images, etc)
    matcher: ["/((?!api|_next/static|_next/image|images|branding|sitemap.xml|robots.txt|favicon.ico|manifest.json|sw.js).*)"],
}
