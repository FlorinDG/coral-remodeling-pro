/**
 * The document's totals — ONE rule for every quote / invoice / proforma / credit note screen, PDF and send. The line
 * values come from lib/records/document-lines (DOC-LINES-1: customer discount per line), the discount on the total is
 * applied before VAT and split over the VAT rates.
 */
import { chargedLines, splitDocumentDiscount, discountOf, documentDiscountOf, type DocLine, type Discount } from '@/lib/records/document-lines';

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
}

interface CalculateTotalsOptions {
    /** @deprecated VAT is ONE document choice applied at the end — never per line (Florin 2026-10-09). Ignored. */
    vatCalcMode?: "total" | "lines";
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
    const effectiveRate = vatRegime === 'medecontractant' ? 0 : parseFloat(vatRegime || '21');
    const isMedecontractant = vatRegime === 'medecontractant';
    const lines = chargedLines(blocks);
    const linesGross = lines.reduce((s, l) => s + l.gross, 0);
    const lineDiscounts = lines.reduce((s, l) => s + l.discount, 0);
    const linesNet = lines.reduce((s, l) => s + l.net, 0);

    // VAT is ONE document choice, applied at the end (Florin 2026-10-09: "vat per line is a no go. ONLY at the end").
    // Prices entered incl. VAT are brought back to their base.
    const baseByRate = new Map<number, number>();
    if (lines.length) baseByRate.set(effectiveRate, vatIncluded ? linesNet / (1 + effectiveRate / 100) : linesNet);
    const split = splitDocumentDiscount(baseByRate, discountOf(options.documentDiscount));

    const vatBreakdown: VatBreakdownItem[] = [...baseByRate.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([rate, base]) => {
            const roundedBase = Math.round((base - (split.byRate.get(rate) || 0)) * 100) / 100;
            const roundedVat = Math.round(roundedBase * (rate / 100) * 100) / 100;
            return { rate, base: roundedBase, vat: roundedVat, isMedecontractant };
        });

    const roundedSubtotal = Math.round(vatBreakdown.reduce((s, v) => s + v.base, 0) * 100) / 100;
    const roundedTotalVAT = Math.round(vatBreakdown.reduce((s, v) => s + v.vat, 0) * 100) / 100;
    const totalInclVAT = Math.round((roundedSubtotal + roundedTotalVAT) * 100) / 100;

    return {
        subtotal: roundedSubtotal,
        vatBreakdown,
        totalVAT: roundedTotalVAT,
        totalInclVAT,
        hasMedecontractant: vatBreakdown.some(v => v.isMedecontractant),
        linesGross: Math.round(linesGross * 100) / 100,
        lineDiscounts: Math.round(lineDiscounts * 100) / 100,
        linesNet: Math.round(linesNet * 100) / 100,
        documentDiscount: split.total,
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
