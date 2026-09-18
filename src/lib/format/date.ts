/**
 * src/lib/format/date.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for date display formatting and week logic (LOC-1).
 *
 * Rules:
 * 1. Storage stays ISO (yyyy-MM-dd / ISO 8601). Display is strictly European (DD/MM/YYYY).
 * 2. Locale comes from the application (default 'nl-BE'), NEVER from machine defaults.
 * 3. WEEK_STARTS_ON = 1 (Monday, ISO 8601).
 * 4. toLocaleDateString() with no argument and 'en-US' are strictly prohibited.
 * ─────────────────────────────────────────────────────────────────
 */

export const WEEK_STARTS_ON = 1; // Monday (ISO 8601)

export const DEFAULT_LOCALE = 'nl-BE';

/**
 * Resolves application locale strings to regional European BCP 47 locales.
 * Enforces en-GB for English to prevent any accidental en-US (MM/DD/YYYY).
 */
export function resolveLocale(locale?: string | null): string {
    if (!locale) return DEFAULT_LOCALE;
    const lower = locale.toLowerCase().trim();
    if (lower.startsWith('nl')) return 'nl-BE';
    if (lower.startsWith('fr')) return 'fr-BE';
    if (lower.startsWith('en')) return 'en-GB'; // Strictly European English
    if (lower.startsWith('ro')) return 'ro-RO';
    if (lower.startsWith('ru')) return 'ru-RU';
    return DEFAULT_LOCALE;
}

/**
 * Safely parses any date input (Date, ISO string, timestamp number) into a Date object.
 * Returns null if input is null, undefined, empty, or unparseable.
 */
export function parseDateInput(d: Date | string | number | null | undefined): Date | null {
    if (d === null || d === undefined || d === '') return null;
    if (d instanceof Date) {
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof d === 'number') {
        const date = new Date(d);
        return isNaN(date.getTime()) ? null : date;
    }
    if (typeof d === 'string') {
        const trimmed = d.trim();
        if (!trimmed) return null;

        // Plain YYYY-MM-DD: parse as local date components to prevent UTC-offset shifts
        const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10);
            const monthIndex = parseInt(ymdMatch[2], 10) - 1;
            const day = parseInt(ymdMatch[3], 10);
            const date = new Date(year, monthIndex, day);
            return isNaN(date.getTime()) ? null : date;
        }

        const parsed = new Date(trimmed);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/**
 * Formats a date into European standard DD/MM/YYYY.
 *
 * Examples:
 *   formatDate('2026-09-18') => '18/09/2026'
 *   formatDate(new Date(2026, 0, 5)) => '05/01/2026'
 */
export function formatDate(d: Date | string | number | null | undefined, locale?: string | null): string {
    if (typeof d === 'string') {
        const trimmed = d.trim();
        // Fast-path & timezone-immune for standard ISO date strings
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }
    }

    const date = parseDateInput(d);
    if (!date) return '';

    const resolved = resolveLocale(locale);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    // In European date formats, DD/MM/YYYY is the canonical representation
    return `${day}/${month}/${year}`;
}

/**
 * Formats a date and time into European standard DD/MM/YYYY HH:mm.
 *
 * Example:
 *   formatDateTime('2026-09-18T14:30:00Z') => '18/09/2026 14:30' (local time)
 */
export function formatDateTime(d: Date | string | number | null | undefined, locale?: string | null): string {
    const date = parseDateInput(d);
    if (!date) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formats a date with the full month name in the given locale (e.g. '18 september 2026').
 */
export function formatDateLong(d: Date | string | number | null | undefined, locale?: string | null): string {
    const date = parseDateInput(d);
    if (!date) return '';

    const resolved = resolveLocale(locale);
    return new Intl.DateTimeFormat(resolved, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
}

/**
 * Formats a date to month and year (e.g. 'september 2026').
 */
export function formatMonthYear(d: Date | string | number | null | undefined, locale?: string | null): string {
    const date = parseDateInput(d);
    if (!date) return '';

    const resolved = resolveLocale(locale);
    return new Intl.DateTimeFormat(resolved, {
        month: 'long',
        year: 'numeric',
    }).format(date);
}
