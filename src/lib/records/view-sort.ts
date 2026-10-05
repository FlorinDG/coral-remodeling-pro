/**
 * GRID-REPLACE · how a view orders its records — ONE rule for the old grid (NotionGrid) and the new one
 * (NotionGridV2). Pure, tested (tests/view-sort.test.ts). Moved out of NotionGrid unchanged:
 *   - records created in the last 2 minutes stay on top (newest first) — a new row never jumps away;
 *   - no sort: newest first; sorts in order: empties last (ascending) / first (descending), numbers as numbers
 *     ("1,5" = 1.5), text naturally ("10" after "2"), case-insensitive.
 */
export interface SortablePage { id: string; createdAt: string; properties: Record<string, unknown> }
export interface SortRuleLike { propertyId: string; direction: 'ascending' | 'descending' }

const RECENT_MS = 120_000;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const empty = (v: unknown) => v === undefined || v === null || v === '';
const t = (iso: string) => new Date(iso).getTime();

export function compareBySorts(a: SortablePage, b: SortablePage, sorts: SortRuleLike[]): number {
    if (!sorts.length) return t(b.createdAt) - t(a.createdAt);
    for (const sort of sorts) {
        const valA = a.properties[sort.propertyId];
        const valB = b.properties[sort.propertyId];
        if (valA === valB) continue;
        const asc = sort.direction === 'ascending';
        if (empty(valA)) return asc ? 1 : -1;
        if (empty(valB)) return asc ? -1 : 1;
        const strA = String(valA).trim(), strB = String(valB).trim();
        const cleanA = strA.replace(',', '.'), cleanB = strB.replace(',', '.');
        const nA = Number(cleanA), nB = Number(cleanB);
        const numeric = cleanA !== '' && cleanB !== '' && Number.isFinite(nA) && Number.isFinite(nB);
        const r = numeric ? nA - nB : collator.compare(strA, strB);
        if (r !== 0) return asc ? r : -r;
    }
    return 0;
}

/** The view's order: recent rows on top (newest first), then the rest by the view's sorts. */
export function sortPages<P extends SortablePage>(pages: P[], sorts: SortRuleLike[], nowMs: number): P[] {
    const recent: P[] = [], rest: P[] = [];
    for (const p of pages) (nowMs - t(p.createdAt) < RECENT_MS ? recent : rest).push(p);
    recent.sort((a, b) => t(b.createdAt) - t(a.createdAt));
    return [...recent, ...[...rest].sort((a, b) => compareBySorts(a, b, sorts))];
}

/**
 * While a cell is being edited the rows keep their positions (an edit must not move the row under the cursor —
 * DSG's "wrong-row overwrite"); new rows join at the end, gone rows leave.
 */
export function holdOrder<P extends { id: string }>(frozenIds: string[] | null, sorted: P[]): P[] {
    if (!frozenIds) return sorted;
    const byId = new Map(sorted.map(p => [p.id, p]));
    const out: P[] = [];
    for (const id of frozenIds) { const p = byId.get(id); if (p) { out.push(p); byId.delete(id); } }
    return [...out, ...byId.values()];
}
