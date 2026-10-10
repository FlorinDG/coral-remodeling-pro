/**
 * TRACE-1 · trace numbers (Florin 2026-10-10: "both shift and hours clocked get a trace number"; format chosen:
 * SH-00123 / HR-00456 — one running series per tenant, never reused). A shift and the hours clocked on it are
 * found from each other by these numbers. Pure; the door that hands them out is lib/data/trace-number.
 */
export const TRACE_SERIES = { shift: 'SH', hours: 'HR' } as const;
export type TraceSeries = (typeof TRACE_SERIES)[keyof typeof TRACE_SERIES];

/** 5 digits, wider once past 99999 — never truncated (the migration numbered the existing rows the same way). */
export function formatTraceNo(series: TraceSeries, n: number): string {
    if (!Number.isInteger(n) || n < 1) throw new Error(`trace number: invalid counter ${n}`);
    return `${series}-${String(n).padStart(5, '0')}`;
}

/** Is this text a trace number of that series (for search and links)? */
export function isTraceNo(text: string | null | undefined, series?: TraceSeries): boolean {
    const m = /^(SH|HR)-(\d{5,})$/.exec((text ?? '').trim().toUpperCase());
    return !!m && (!series || m[1] === series);
}
