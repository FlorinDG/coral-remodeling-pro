import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['nl', 'en', 'fr', 'ro', 'ru'],

    // Used when no locale matches
    defaultLocale: 'nl',
    localeDetection: true,

    // Never put /nl/ (or any locale) in the URL.
    // Locale is resolved from the NEXT_LOCALE cookie + Accept-Language header.
    localePrefix: 'never',
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
