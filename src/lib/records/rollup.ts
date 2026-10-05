/**
 * A ROLLUP field's value — ONE rule for the old grid, the new grid and the record modal (it was copied in the old
 * grid's rollup cell and in PageModal). Pure, tested (tests/rollup.test.ts). Moved unchanged:
 * the related records' target field, empties skipped, then the aggregation — except sum / average, which now read
 * Belgian decimals (see amountOf).
 */
import { parseCellInput as parseNumberText } from '@/components/admin/database/columns/numberCell';
export interface RollupResult { value: string; targetDbId?: string; targetPageId?: string }

/** Where a related record lives and what it holds (the caller's index of loaded records). */
export type LocatePage = (pageId: string) => { databaseId: string; properties: Record<string, unknown> } | null;

export function collectRollup(relationIds: unknown, locate: LocatePage, targetPropertyId: string): RollupResult[] {
    if (!Array.isArray(relationIds) || !targetPropertyId) return [];
    const out: RollupResult[] = [];
    for (const id of relationIds) {
        const hit = locate(String(id));
        if (!hit) continue;
        const v = hit.properties[targetPropertyId];
        if (v !== undefined && v !== null && String(v).trim() !== '') out.push({ value: String(v), targetDbId: hit.databaseId, targetPageId: String(id) });
    }
    return out;
}

/**
 * A rollup value as a number: currency signs and spaces dropped, then the one number reading ("10,5" = 10.5,
 * "1 250,75" = 1250.75). It stripped the comma ("10,5" → 105) — a sum over Belgian decimals was wrong by 10×.
 */
function amountOf(v: string): number {
    return parseNumberText(v.replace(/[^\d,.\- ]/g, '')) ?? 0;
}

export function applyRollupAggregation(results: RollupResult[], aggregation?: string): RollupResult[] {
    if (!results || results.length === 0) return [];
    switch (aggregation || 'show_original') {
        case 'extract_numbers':
            return results.map(r => ({ ...r, value: r.value.replace(/[^\d+]/g, '') })).filter(r => Boolean(r.value));
        case 'sum':
            return [{ value: String(Math.round(results.reduce((acc, c) => acc + amountOf(c.value), 0) * 100) / 100) }];
        case 'average': {
            const sum = results.reduce((acc, c) => acc + amountOf(c.value), 0);
            return [{ value: String(Number((sum / results.length).toFixed(2))) }];
        }
        case 'count':
            return [{ value: String(results.length) }];
        default:
            return results;
    }
}

/** A locator over loaded databases (built once per render by the caller). */
export function locatorOf(databases: Array<{ id: string; pages: Array<{ id: string; properties: Record<string, unknown> }> }>): LocatePage {
    const index = new Map<string, { databaseId: string; properties: Record<string, unknown> }>();
    for (const db of databases) for (const p of db.pages) index.set(p.id, { databaseId: db.id, properties: p.properties || {} });
    return id => index.get(id) ?? null;
}
