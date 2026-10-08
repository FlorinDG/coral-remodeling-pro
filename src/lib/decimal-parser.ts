/**
 * Display formatting of decimals (nl-BE). Parsing: lib/records/decimal (DEC-1) — the one typed-number rule.
 */

import { parseDecimal as parseDecimalRule } from './records/decimal';

/** DEC-1: the ONE rule lives in lib/records/decimal — this keeps its older callers' `undefined` for "no number". */
export function parseDecimal(raw: string | number | null | undefined): number | undefined {
    return parseDecimalRule(raw) ?? undefined;
}

export function formatDecimal(n: number | undefined | null, decimals = 2): string {
    if (n === undefined || n === null || n === 0) return '';
    return n.toLocaleString('nl-BE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
