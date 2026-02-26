import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
    // Match only internationalized pathnames
    // matcher: ['/', '/(nl|en|fr|ro)/:path*']
    matcher: ['/((?!api|_next|_static|_vercel|.*\\..*).*)']
};
