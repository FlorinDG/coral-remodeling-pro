/**
 * DEC-1 · a typed number, the Belgian way and the other way — ONE rule for every amount, quantity, price and
 * percentage a person types (Florin 2026-10-08: "comma / point in belgian currency format not yet fixed. i am still
 * typing period instead of comma"). Pure, tested (tests/decimal.test.ts).
 *
 * Reading: both separators are accepted; the LAST one is the decimal separator, any before it group thousands —
 * "12,5" = "12.5" = 12.5 · "1.234,56" = "1,234.56" = 1234.56 · "€ 1 234,56" = 1234.56.
 * Showing: Belgian — a comma, no thousands grouping while typing ("1234,5"), grouped in read-only text (formatEuro).
 * Replaces lib/decimal-parser.ts and number-cell's own parse (which read "1.234,56" as no number).
 */

/** The number typed text stands for, or null (empty / not a number). */
export function parseDecimal(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    let s = String(raw).trim().replace(/[\s €%]/g, '');
    if (!s) return null;
    const neg = s.startsWith('-');
    s = s.replace(/[^0-9.,]/g, '');
    if (!s) return null;
    const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    const whole = last >= 0 ? s.slice(0, last).replace(/[.,]/g, '') : s;
    const frac = last >= 0 ? s.slice(last + 1) : '';
    const n = Number(`${whole || '0'}${frac ? `.${frac}` : ''}`);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** A number as a person edits it: comma decimal, no grouping, at most `decimals` places, trailing zeros dropped. */
export function formatDecimalInput(n: number | null | undefined, decimals = 2): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return '';
    return String(Number(n.toFixed(decimals))).replace('.', ',');
}
