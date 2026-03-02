import { auth } from "./auth"
import { NextResponse } from "next/server"
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { pathname } = req.nextUrl

    // Match any admin or portal path but NOT the login page and NOT API routes
    const isProtectedPath = pathname.includes("/admin") || pathname.includes("/portal");
    const isLoginPage = pathname.includes("/admin/login");

    if (isProtectedPath && !isLoginPage && !isLoggedIn) {
        // Redirect to localized login. 
        // We can manually prefix or let intlMiddleware handle it later, 
        // but a direct redirect here is cleaner for NextAuth.

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
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
