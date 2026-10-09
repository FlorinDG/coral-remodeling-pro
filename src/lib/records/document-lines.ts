/**
 * DOC-LINES-1 · what a quote / invoice / proforma / credit note line is worth — the ONE rule for the editor rows, the
 * totals, the PDFs and the Peppol send. Pure, tested (tests/document-lines.test.ts).
 *
 * Found 2026-10-09: the line value was computed in five places that disagreed — the totals counted variant surcharges
 * and subcomponents, the Peppol send ignored both (price × quantity), each PDF had its own copy. And Florin: "i don't
 * have a way to set discounts in quotes nor invoices" — decided: a discount on the line AND on the total, each a
 * percentage or a fixed amount, the same on proformas and credit notes.
 *
 * A line's value: its unit price (+ the variant surcharge frozen on it — lib/records/variant-price) × its quantity; a
 * line with subcomponents is worth the sum of its subcomponents × its quantity. The line's CUSTOMER discount comes off
 * that (never below 0). `discountPercent` on a line is the SUPPLIER discount (cost side, margin) — not this.
 *
 * DOC-LINES-2 (Florin 2026-10-09: "rounding then adding — it is standard"): a line's value is rounded to the cent AT
 * THE LINE; every total is a sum of rounded lines (EN 16931 BR-CO-10). Each line has a VAT rate — its own, else the
 * document's (mixed rates: "yes").
 */
import { lineVariantDelta } from './variant-price';

export type DiscountKind = 'pct' | 'amount';
/** A customer discount: a percentage of the value, or a fixed amount (in the document's currency). */
export interface Discount { kind: DiscountKind; value: number }

/** The block fields this rule reads — structural, so core never imports the editor's Block type. */
export interface DocLine {
    type?: string;
    quantity?: number | null;
    unitPrice?: number | null;
    verkoopPrice?: number | null;
    variantPriceDelta?: unknown;
    isOptional?: boolean;
    children?: DocLine[] | null;
    clientDiscount?: Discount | null;
    /**
     * DOC-LINES-2: a rate set BY HAND on this line (mixed rates). Absent = the document's regime — the default
     * (Florin 2026-10-09: "VAT has to have a default, and it must be the set regime for the lines. and manually
     * edited if the case presents itself"). The legacy `vatRate` is NOT read: old screens and imports left it on
     * lines (e.g. regime 21 with lines at 6) and it never counted — reading it would change issued documents.
     */
    vatRateOverride?: number | null;
}

const PRICED = new Set(['line', 'article', 'bestek']);
const CONTAINERS = new Set(['section', 'subsection', 'post']);
const finite = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Rounds money to the cent, half away from zero, without binary noise (33.335 → 33.34; Math.round(33.335 * 100)
 * gives 33.33 because 33.335 is 33.33499… in binary).
 */
export function roundCents(n: number): number {
    if (!Number.isFinite(n)) return 0;
    const r = Math.round(Number(`${Math.abs(n).toFixed(9)}e2`)) / 100;
    return n < 0 ? -r : r;
}
const round2 = roundCents;

/** A line's VAT rate: the document's, unless one was set by hand on the line (0–100). */
export function lineRate(b: DocLine, documentRate: number): number {
    const r = b.vatRateOverride;
    return typeof r === 'number' && Number.isFinite(r) && r >= 0 && r <= 100 ? r : documentRate;
}

/** A discount read from a block or a document — anything not a positive number is no discount. */
export function discountOf(d: unknown): Discount | null {
    if (!d || typeof d !== 'object') return null;
    const { kind, value } = d as { kind?: unknown; value?: unknown };
    const v = typeof value === 'number' ? value : Number(value);
    if ((kind !== 'pct' && kind !== 'amount') || !Number.isFinite(v) || v <= 0) return null;
    return { kind, value: kind === 'pct' ? Math.min(v, 100) : v };
}

/** How much a discount takes off a value (never more than the value). */
export function discountAmount(value: number, d: Discount | null | undefined): number {
    const x = discountOf(d);
    if (!x || value <= 0) return 0;
    return Math.min(value, x.kind === 'pct' ? value * x.value / 100 : x.value);
}

/** The price per unit as the line charges it: its own price + the frozen variant surcharge. */
export function lineUnitPrice(b: DocLine): number {
    return finite(b.unitPrice ?? b.verkoopPrice) + lineVariantDelta(b);
}

/** Unrounded: subcomponents (each rounded) summed × quantity, or the unit price × quantity. */
function rawGross(b: DocLine): number {
    const qty = finite(b.quantity) || 1;
    const kids = (b.children || []).filter(Boolean);
    if (kids.length) return kids.reduce((s, c) => s + (c.isOptional ? 0 : lineNet(c)), 0) * qty;
    return lineUnitPrice(b) * qty;
}

/** A priced line's value BEFORE its customer discount, to the cent. Optional subcomponents don't count. */
export function lineGross(b: DocLine): number {
    return round2(rawGross(b));
}

/** The customer discount on a line, to the cent. */
export function lineDiscount(b: DocLine): number {
    return round2(discountAmount(lineGross(b), b.clientDiscount));
}

/** A priced line's value AFTER its customer discount, to the cent. */
export function lineNet(b: DocLine): number {
    return round2(lineGross(b) - lineDiscount(b));
}

/** The net price per unit (the line's value after discount ÷ quantity) — what an e-invoice states as the line price. */
export function lineNetUnitPrice(b: DocLine): number {
    const qty = finite(b.quantity) || 1;
    return lineNet(b) / qty;
}

/**
 * A charged line, to the cent. `quantity`: the line's quantity × the quantities of the posts holding it — what the
 * line is charged for. `rate`: its VAT rate (its own, else the document's).
 */
export interface PricedLine { block: DocLine; quantity: number; gross: number; discount: number; net: number; rate: number }

/** The document's priced, non-optional lines at the level they are charged (a line with subcomponents is ONE line). */
export function chargedLines(blocks: DocLine[] | null | undefined, opts: { documentRate?: number } = {}): PricedLine[] {
    const documentRate = opts.documentRate ?? 21;
    const out: PricedLine[] = [];
    // A "post" (phase) multiplies what it holds by its quantity; a section / subsection only groups (as the totals did).
    const walk = (nodes: DocLine[] | null | undefined, mult: number) => {
        for (const b of nodes || []) {
            if (!b || b.isOptional) continue;
            if (b.type && CONTAINERS.has(b.type)) { walk(b.children, b.type === 'post' ? mult * (finite(b.quantity) || 1) : mult); continue; }
            if (b.type && PRICED.has(b.type)) {
                const gross = mult === 1 ? lineGross(b) : round2(rawGross(b) * mult);
                const discount = round2(discountAmount(gross, b.clientDiscount));
                out.push({ block: b, quantity: (finite(b.quantity) || 1) * mult, gross, discount, net: round2(gross - discount), rate: lineRate(b, documentRate) });
            }
        }
    };
    walk(blocks, 1);
    return out;
}

export interface DocumentDiscountSplit { total: number; byRate: Map<number, number> }

/**
 * The discount on the TOTAL, applied before VAT: a percentage of the lines' net sum, or a fixed amount (never more than
 * the sum), split over the VAT rates in proportion to each rate's base — the last rate takes the rounding cent.
 */
export function splitDocumentDiscount(baseByRate: Map<number, number>, d: Discount | null | undefined): DocumentDiscountSplit {
    const sum = [...baseByRate.values()].reduce((s, v) => s + v, 0);
    const total = round2(discountAmount(sum, d));
    const byRate = new Map<number, number>();
    if (total <= 0 || sum <= 0) return { total: 0, byRate };
    const rates = [...baseByRate.keys()];
    let given = 0;
    rates.forEach((rate, i) => {
        const share = i === rates.length - 1 ? round2(total - given) : round2(total * (baseByRate.get(rate)! / sum));
        byRate.set(rate, share);
        given = round2(given + share);
    });
    return { total, byRate };
}

/**
 * What a block is worth in the editor / on paper: a container is the sum of what it holds (a "post" × its quantity, as
 * in the totals), a priced line its net value, anything else nothing. An OPTIONAL block is worth nothing unless asked to
 * show its value anyway (the PDF prints an optional line's price struck through).
 */
export function blockValue(b: DocLine | null | undefined, opts: { includeOptional?: boolean } = {}): number {
    if (!b) return 0;
    if (b.isOptional && !opts.includeOptional) return 0;
    if (b.type && CONTAINERS.has(b.type)) {
        const sum = (b.children || []).reduce((s, c) => s + blockValue(c, opts), 0);
        return b.type === 'post' ? sum * (finite(b.quantity) || 1) : sum;
    }
    if (b.type && PRICED.has(b.type)) return lineNet(b);
    return 0;
}

/** The document's discount on the total, from its properties (clientDiscountKind + clientDiscountValue). */
export function documentDiscountOf(props: Record<string, unknown> | null | undefined): Discount | null {
    const p = props || {};
    return discountOf({ kind: p.clientDiscountKind, value: p.clientDiscountValue });
}

/** The properties that store a discount on the total (null clears it). */
export function documentDiscountProps(d: Discount | null): Record<string, unknown> {
    const x = discountOf(d);
    return { clientDiscountKind: x ? x.kind : null, clientDiscountValue: x ? x.value : null };
}
