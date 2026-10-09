/**
 * The document's totals — ONE rule for every quote / invoice / proforma / credit note screen, PDF and send. The line
 * values come from lib/records/document-lines (DOC-LINES-1: customer discount per line), the discount on the total is
 * applied before VAT and split over the VAT rates.
 */
import { chargedLines, splitDocumentDiscount, discountOf, documentDiscountOf, roundCents, type DocLine, type Discount } from '@/lib/records/document-lines';

/** The document's rate from its regime ('21', '6', …); reverse charge is handled by the caller. */
export function documentRateOf(vatRegime: string | null | undefined): number {
    const r = parseFloat(vatRegime || '21');
    return Number.isFinite(r) ? r : 21;
}

export interface VatBreakdownItem {
    rate: number;
    base: number;
    vat: number;
    isMedecontractant: boolean;
}

export interface InvoiceTotals {
    /** The base for VAT: the lines' net values, minus the discount on the total. */
    subtotal: number;
    vatBreakdown: VatBreakdownItem[];
    totalVAT: number;
    totalInclVAT: number;
    hasMedecontractant: boolean;
    /** The lines' gross values (before any customer discount). */
    linesGross: number;
    /** The customer discounts on the lines, together. */
    lineDiscounts: number;
    /** The lines' net values (after their discounts) — before the discount on the total. */
    linesNet: number;
    /** The discount on the total (before VAT). */
    documentDiscount: number;
    /** DOC-LINES-2: each charged line as it is taxed — the e-invoice states exactly these (lib/peppol-payload). */
    lines: TaxedLine[];
    /** The discount on the total, per VAT rate (one allowance per rate on the e-invoice). */
    discountByRate: { rate: number; amount: number }[];
}

export interface TaxedLine {
    block: DocLine;
    /** What the line is charged for: its quantity × the posts holding it. */
    quantity: number;
    rate: number;
    /** The line's value excl. VAT, to the cent. */
    base: number;
    /** The line's VAT, to the cent. */
    vat: number;
}

interface CalculateTotalsOptions {
    vatRegime?: string;
    vatIncluded?: boolean;
    databaseStoreState?: any;
    /** DOC-LINES-1: the discount on the total (from the document's clientDiscount property). */
    documentDiscount?: Discount | null;
}

export function calculateInvoiceTotals(
    blocks: DocLine[],
    options: CalculateTotalsOptions = {}
): InvoiceTotals {
    const { vatRegime = '21', vatIncluded = false } = options;
    const isMedecontractant = vatRegime === 'medecontractant';
    const documentRate = isMedecontractant ? 0 : documentRateOf(vatRegime);
    const lines = chargedLines(blocks, { documentRate });
    const linesGross = lines.reduce((s, l) => s + l.gross, 0);
    const lineDiscounts = lines.reduce((s, l) => s + l.discount, 0);
    const linesNet = lines.reduce((s, l) => s + l.net, 0);

    // DOC-LINES-2 (Florin 2026-10-09). Each line has its rate (mixed rates: "yes"); reverse charge is the whole
    // document at 0. "La somme des arrondis": each line's VAT is rounded, then the VATs are added per rate. Prices
    // entered incl. VAT: the line's base is rounded, and its VAT is the rest.
    const byRate = new Map<number, { base: number; vat: number }>();
    const taxed: TaxedLine[] = lines.map(l => {
        const rate = isMedecontractant ? 0 : l.rate;
        const base = vatIncluded ? roundCents(l.net / (1 + rate / 100)) : l.net;
        const vat = vatIncluded ? roundCents(l.net - base) : roundCents(base * rate / 100);
        return { block: l.block, quantity: l.quantity, rate, base, vat };
    });
    for (const { rate, base, vat } of [...taxed].sort((a, b) => b.rate - a.rate)) {
        const g = byRate.get(rate) || { base: 0, vat: 0 };
        g.base += base;
        g.vat += vat;
        byRate.set(rate, g);
    }
    // The discount on the total, before VAT: split over the rates by their base; each share takes its own rounded VAT off.
    const split = splitDocumentDiscount(new Map([...byRate].map(([r, g]) => [r, g.base])), discountOf(options.documentDiscount));

    const vatBreakdown: VatBreakdownItem[] = [...byRate.entries()].map(([rate, g]) => {
        const share = split.byRate.get(rate) || 0;
        return {
            rate,
            base: roundCents(g.base - share),
            vat: roundCents(g.vat - roundCents(share * rate / 100)),
            isMedecontractant,
        };
    });

    const roundedSubtotal = roundCents(vatBreakdown.reduce((s, v) => s + v.base, 0));
    const roundedTotalVAT = roundCents(vatBreakdown.reduce((s, v) => s + v.vat, 0));
    const totalInclVAT = roundCents(roundedSubtotal + roundedTotalVAT);

    return {
        subtotal: roundedSubtotal,
        vatBreakdown,
        totalVAT: roundedTotalVAT,
        totalInclVAT,
        hasMedecontractant: vatBreakdown.some(v => v.isMedecontractant),
        linesGross: roundCents(linesGross),
        lineDiscounts: roundCents(lineDiscounts),
        linesNet: roundCents(linesNet),
        documentDiscount: split.total,
        lines: taxed,
        discountByRate: [...split.byRate.entries()].filter(([, a]) => a > 0).map(([rate, amount]) => ({ rate, amount })),
    };
}

/**
 * DOC-LINES-1 · a document's totals from the document itself — its prices incl./excl. VAT, its VAT regime, its discount
 * on the total — so no screen, PDF or send forgets one of them. VAT: one document choice, at the end.
 */
export function documentTotals(
    blocks: DocLine[] | null | undefined,
    props: Record<string, unknown> | null | undefined,
): InvoiceTotals {
    const p = props || {};
    return calculateInvoiceTotals(blocks || [], {
        vatIncluded: !!p.vatIncluded,
        vatRegime: (p.vatRegime as string) || '21',
        documentDiscount: documentDiscountOf(p),
    });
}
