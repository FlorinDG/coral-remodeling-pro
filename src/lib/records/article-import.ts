/**
 * Library articles — the ART code and the spreadsheet import plan. Pure, tested (tests/article-import.test.ts).
 *
 * The rule lived three times (store createPage, store addPages, SpreadsheetImportModal) behind
 * `databaseId === 'db-articles'`, which never matched a tenant's bound id: imported articles got no ART code
 * and every import created duplicates (Florin 2026-10-05: "I had noticed this behavior, never fixed").
 * 🟨 The code is computed from the articles the browser has loaded (the full library at import); server-side
 * numbering belongs to WO-LIB-1.
 */

type Props = Record<string, unknown>;

/** Artikelgroep option → its two-digit code; unknown / none → '00'. */
export const ARTICLE_GROUP_CODE: Readonly<Record<string, string>> = {
    'opt-ruwbouw': '01',
    'opt-afwerking': '02',
    'opt-elektriciteit': '03',
    'opt-sanitaire': '04',
    'opt-ventilatie': '05',
    'opt-verwarming': '06',
};

export function articleGroupCode(groupValue: unknown): string {
    return (typeof groupValue === 'string' && ARTICLE_GROUP_CODE[groupValue]) || '00';
}

/** Highest sequence per group among existing codes (ART-GG-NNNN). */
export function articleCounters(existingCodes: Iterable<unknown>): Record<string, number> {
    const max: Record<string, number> = {};
    for (const c of existingCodes) {
        const m = typeof c === 'string' ? c.match(/^ART-(\d{2})-(\d+)$/) : null;
        if (!m) continue;
        const n = parseInt(m[2], 10);
        if (!max[m[1]] || n > max[m[1]]) max[m[1]] = n;
    }
    return max;
}

/**
 * Codes for new articles, continuing each group's sequence. Returns one code per row, in order; a row that
 * already carries a code keeps it (null in the result). `counters` is advanced in place.
 */
export function nextArticleCodes(rows: Array<{ group: unknown; code?: unknown }>, counters: Record<string, number>): Array<string | null> {
    return rows.map(r => {
        if (typeof r.code === 'string' && r.code.trim()) return null;
        const g = articleGroupCode(r.group);
        counters[g] = (counters[g] || 0) + 1;
        return `ART-${g}-${String(counters[g]).padStart(4, '0')}`;
    });
}

export interface ImportPlan<R> { create: R[]; update: Array<{ id: string; properties: R }>; skipped: number }

/**
 * Upsert plan for an article import — same title (case/space-insensitive) AND same supplier = the same
 * article: updated, or skipped when nothing differs; same title with another supplier = a new article.
 */
export function articleImportPlan<R extends Props>(
    rows: R[],
    existing: Array<{ id: string; properties: Props }>,
    keys: { title: string; supplier?: string; compare: string[] },
): ImportPlan<R> {
    const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();
    const supplierOf = (p: Props) => (keys.supplier && Array.isArray(p[keys.supplier]) ? (p[keys.supplier] as unknown[])[0] ?? null : null);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) || (!a && !b);
    const plan: ImportPlan<R> = { create: [], update: [], skipped: 0 };
    for (const row of rows) {
        const title = norm(row[keys.title]);
        const match = title ? existing.find(e => norm(e.properties[keys.title]) === title && supplierOf(e.properties) === supplierOf(row)) : undefined;
        if (!match) { plan.create.push(row); continue; }
        // Only what the file carries is compared (an update MERGES — the article's own ART code etc. stay).
        if (keys.compare.filter(k => k in row).every(k => same(row[k], match.properties[k]))) { plan.skipped++; continue; }
        plan.update.push({ id: match.id, properties: row });
    }
    return plan;
}
