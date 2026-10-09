/**
 * LINE-SEARCH-1 · find a material in the lines of purchase invoices and supplier quotes, and take it into the library
 * (Florin 2026-10-08: "a great way to add articles from purchase invoices is a search function that reads the invoices,
 * or the extracted article data" · 2026-10-09: no VAT on the article — the engines set it). Pure, tested
 * (tests/purchase-line-search.test.ts).
 *
 * A line is read from the document's line rows (financial-row blocks, lib/records/purchase-lines); the document's facts
 * (supplier, date) through the purchase editor's view. Matching: every word typed appears in the description, the
 * supplier's article code or the supplier — accents and case ignored.
 */
import { purchaseView } from './purchase-document';

type Props = Record<string, unknown>;

export interface PurchaseDocument { id: string; databaseId: string; role: string; properties: Props; blocks: unknown }

export interface LineHit {
    documentId: string; databaseId: string; role: string;
    documentTitle: string; supplier: string; supplierIds: string[]; date: string;
    lineId: string; description: string; articleCode: string;
    quantity: number; unitCode: string; gross: number; discount: number; net: number;
}

const fold = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const n = (v: unknown) => { const x = typeof v === 'number' ? v : Number(v); return Number.isFinite(x) ? x : 0; };
const stripHtml = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Every line of a purchase document, with the document's facts. */
export function linesOf(doc: PurchaseDocument): LineHit[] {
    const v = purchaseView(doc.role, doc.properties || {});
    const blocks = Array.isArray(doc.blocks) ? (doc.blocks as Array<Record<string, unknown>>) : [];
    const supplierIds = Array.isArray(doc.properties?.supplier) ? (doc.properties.supplier as unknown[]).map(String) : [];
    return blocks
        .filter(b => b && b.type === 'financial-row')
        .map(b => {
            const p = (b.properties || {}) as Props;
            return {
                documentId: doc.id, databaseId: doc.databaseId, role: doc.role,
                documentTitle: String(doc.properties?.title ?? ''),
                supplier: String(v.supplierName ?? ''), supplierIds,
                date: String(v.invoiceDate ?? '').slice(0, 10),
                lineId: String(b.id ?? ''),
                description: stripHtml(b.content),
                articleCode: String(p.articleCode ?? '').trim(),
                quantity: n(p.quantity) || 1,
                unitCode: String(p.unitCode ?? 'C62'),
                gross: n(p.unitPrice),
                discount: n(p.discountPct),
                net: n(p.lineTotal),
            };
        })
        .filter(h => h.description || h.articleCode);
}

/** The lines matching every word of the query — newest document first. An empty query finds nothing. */
export function searchLines(docs: PurchaseDocument[], query: string, limit = 100): LineHit[] {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const hits: LineHit[] = [];
    for (const d of docs) {
        for (const h of linesOf(d)) {
            const hay = fold(`${h.description} ${h.articleCode} ${h.supplier}`);
            if (words.every(w => hay.includes(w))) hits.push(h);
        }
    }
    return hits.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

// ── Into the library ─────────────────────────────────────────────────────────────────────────────────────────────

/** UN/ECE unit codes (Peppol, readings) → the library's unit options (kernel db-articles 'prop-art-unit'). */
const UNIT_OF_CODE: Readonly<Record<string, string>> = {
    C62: 'u-stk', H87: 'u-stk', EA: 'u-stk', PCE: 'u-stk', XPP: 'u-stk',
    MTR: 'u-m', MTK: 'u-m2', MTQ: 'u-m3', LTR: 'u-l', HUR: 'u-uur', SET: 'u-set', KGM: 'u-kg',
};
/** The library unit a line's unit code stands for — "stuk" when unknown (Florin 2026-10-08: default stuk). */
export function libraryUnitOf(unitCode: string | null | undefined): string {
    return UNIT_OF_CODE[String(unitCode ?? '').toUpperCase()] ?? 'u-stk';
}

export const ARTICLE_SUPPLIER_CODE = 'prop-art-supplier-code';
export const ARTICLE_PRICE_HISTORY = 'prop-art-price-history';

export interface PriceEntry { date: string; gross: number; discount: number; supplier: string; documentId: string }

/** The article's price history (stored as a JSON list) — tolerant of an empty or broken value. */
export function priceHistoryOf(v: unknown): PriceEntry[] {
    try {
        const list = typeof v === 'string' ? JSON.parse(v || '[]') : v;
        return Array.isArray(list) ? (list as PriceEntry[]) : [];
    } catch { return []; }
}

/** Which existing article this line is: the same supplier article code AND the same supplier (linked, or by name). */
export function matchArticle(hit: LineHit, articles: Array<{ id: string; properties: Props }>): string | null {
    if (!hit.articleCode) return null;
    const code = fold(hit.articleCode);
    const name = fold(hit.supplier);
    for (const a of articles) {
        if (fold(a.properties[ARTICLE_SUPPLIER_CODE]) !== code) continue;
        const linked = Array.isArray(a.properties['prop-art-supplier']) ? (a.properties['prop-art-supplier'] as unknown[]).map(String) : [];
        if (hit.supplierIds.some(id => linked.includes(id))) return a.id;
        if (name && priceHistoryOf(a.properties[ARTICLE_PRICE_HISTORY]).some(e => fold(e.supplier) === name)) return a.id;
    }
    return null;
}

/**
 * The fields to write: a NEW article gets its name, code, supplier, unit, gross price and discount; an EXISTING one gets
 * the new gross price and discount, its old ones kept in the price history (the newest entry last). No VAT — the
 * quote / invoice engines set it.
 */
export function articleFieldsFromLine(hit: LineHit, unit: string, existing: Props | null): Props {
    const history = priceHistoryOf(existing?.[ARTICLE_PRICE_HISTORY]);
    const entry: PriceEntry = { date: hit.date, gross: hit.gross, discount: hit.discount, supplier: hit.supplier, documentId: hit.documentId };
    const nextHistory = [...history.filter(e => e.documentId !== hit.documentId), entry];
    const price = { 'prop-art-bruto': hit.gross, 'prop-art-remise': hit.discount, [ARTICLE_PRICE_HISTORY]: JSON.stringify(nextHistory) };
    if (existing) return price;
    return {
        title: hit.description,
        [ARTICLE_SUPPLIER_CODE]: hit.articleCode,
        ...(hit.supplierIds.length ? { 'prop-art-supplier': hit.supplierIds.slice(0, 1) } : {}),
        'prop-art-unit': unit,
        ...price,
    };
}
