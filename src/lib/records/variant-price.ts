/**
 * VARIANT-1 · an article's variant surcharge on a document line — FROZEN on the line when the variant is picked.
 * Pure, tested (tests/variant-price.test.ts).
 *
 * Florin 2026-10-05 ("b — yes, apply only to new documents"). The surcharge was looked up LIVE from the library in
 * ~9 places that disagreed (editor row: yes; stored totals and PDFs: never — `id === 'db-articles'`; public
 * viewer: yes, at view time), so one document showed three totals and a later library price change rewrote old
 * ones. Now the line carries `variantPriceDelta` from the moment the variant is chosen and everything reads only
 * that. A line from before has none → 0, exactly what its PDF printed: old documents do not change.
 */

export interface VariantOption { id: string; name?: string; priceDelta: number }
export interface VariantAxis { id: string; name?: string; options: VariantOption[] }

/** The surcharge of a selection against the article's variant axes (computed ONCE, at selection). */
export function variantDelta(selected: Record<string, string> | null | undefined, axes: VariantAxis[] | null | undefined): number {
    if (!selected || !Array.isArray(axes)) return 0;
    let delta = 0;
    for (const [axisId, optId] of Object.entries(selected)) {
        const opt = axes.find(a => a.id === axisId)?.options?.find(o => o.id === optId);
        if (opt && Number.isFinite(Number(opt.priceDelta))) delta += Number(opt.priceDelta);
    }
    return Math.round(delta * 100) / 100;
}

/** What every renderer, total and PDF adds to a line's unit price: the frozen surcharge, nothing looked up. */
export function lineVariantDelta(block: { variantPriceDelta?: unknown } | null | undefined): number {
    const v = Number(block?.variantPriceDelta);
    return Number.isFinite(v) ? v : 0;
}
