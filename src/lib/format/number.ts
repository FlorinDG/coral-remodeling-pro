/**
 * src/lib/format/number.ts — display formatting of numbers that are not money (LOC-1 rules, as lib/format/date).
 * Locale from the application or the document's language — never the machine's.
 */
import { resolveLocale } from './date';

/** A percentage as the language writes it: 12,5% (nl / fr) — 12.5% (en). At most 2 decimals. */
export function formatPercent(n: number, lang?: string): string {
    return `${new Intl.NumberFormat(resolveLocale(lang), { maximumFractionDigits: 2 }).format(n)}%`;
}
