import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { pathname } = req.nextUrl

    // Match any admin or portal path but NOT the login page and NOT API routes
    const isProtectedPath = pathname.includes("/admin") || pathname.includes("/portal");
    const isLoginPage = pathname.includes("/admin/login");
    const isTimeTrackerPath = pathname.includes("/admin/time-tracker");

    if (isProtectedPath && !isLoginPage && !isTimeTrackerPath && !isLoggedIn) {
        const parts = pathname.split('/');
        const locale = parts[1];
        const hasLocale = ['en', 'nl', 'fr', 'ro'].includes(locale);
        const redirectPath = hasLocale ? `/${locale}/admin/login` : '/admin/login';

        return NextResponse.redirect(new URL(redirectPath, req.nextUrl))
    }

    return intlMiddleware(req)
})

export const config = {
    // Matcher for next-intl + next-auth
    // Skip all internal paths (_next) and static assets (images, etc)
    matcher: ["/((?!api|_next/static|_next/image|images|branding|sitemap.xml|robots.txt|favicon.ico|manifest.json|sw.js).*)"],
}
