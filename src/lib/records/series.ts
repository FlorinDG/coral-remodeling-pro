/**
 * PROFORMA-2 · a document series — "PF-2026-001", "PF-2026-002" … (Florin 2026-10-06: proformas "get their own
 * series (PF-2026-001) - good idea"). Pure, tested (tests/series.test.ts). The record door assigns the next number
 * INSIDE its serializable transaction (lib/data/records `createIfMissing.series`): two simultaneous creations can
 * never get the same number — one is retried and reads the other's.
 */
export interface Series { prefix: string; width: number }

/** The proforma series of a year (the BUSINESS year — Brussels). */
export function proformaSeries(year: string): Series {
    return { prefix: `PF-${year}-`, width: 3 };
}

/** The next number after the highest one taken in this series (gaps are never refilled — numbers are not reused). */
export function nextInSeries(takenTitles: string[], s: Series): string {
    let max = 0;
    for (const t of takenTitles) {
        if (!t.startsWith(s.prefix)) continue;
        const m = /^(\d+)$/.exec(t.slice(s.prefix.length).trim());
        if (m) max = Math.max(max, Number(m[1]));
    }
    return `${s.prefix}${String(max + 1).padStart(s.width, '0')}`;
}
