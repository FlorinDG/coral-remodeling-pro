/** FROZEN copy of lib/invoice-totals.ts before DOC-LINES-1 (2026-10-09) — the reference the new rule must equal when no discount is set. Never edited, never imported by src. */
import { lineVariantDelta } from '../src/lib/records/variant-price.ts';


export interface VatBreakdownItem {
    rate: number;
    base: number;
    vat: number;
    isMedecontractant: boolean;
}

export interface InvoiceTotals {
    subtotal: number;
    vatBreakdown: VatBreakdownItem[];
    totalVAT: number;
    totalInclVAT: number;
    hasMedecontractant: boolean;
}

interface CalculateTotalsOptions {
    vatCalcMode?: "total" | "lines";
    vatRegime?: string;
    vatIncluded?: boolean;
    databaseStoreState?: any;
}

export function calculateInvoiceTotals(
    blocks: Block[],
    options: CalculateTotalsOptions = {}
): InvoiceTotals {
    const { vatRegime = '21', vatIncluded = false, databaseStoreState } = options;

    let subtotal = 0;
    const vatMap = new Map<number, { base: number; isMedecontractant: boolean }>();

    // VARIANT-1: the surcharge frozen on the line — never looked up (lib/records/variant-price)
    const getVariantDeltas = (b: Block): number => lineVariantDelta(b);

    const accumulate = (nodes: Block[], multiplier = 1) => {
        (nodes || []).forEach(b => {
            if (b.isOptional) return;

            const currentQty = (b.type === 'line' || b.type === 'article' || b.type === 'bestek' || b.type === 'post')
                ? (b.quantity || 1)
                : 1;
            const nextMultiplier = multiplier * currentQty;

            if (b.children && b.children.length > 0) {
                accumulate(b.children, nextMultiplier);
                return;
            }

            if (b.type === 'line' || b.type === 'article' || b.type === 'bestek') {
                const price = (b.unitPrice !== undefined ? b.unitPrice : b.verkoopPrice) ?? 0;
                const vDeltas = getVariantDeltas(b);
                const lineGross = (price + vDeltas) * nextMultiplier;

                const effectiveRate = vatRegime === 'medecontractant' ? 0 : parseFloat(vatRegime || '21');

                const base = vatIncluded ? (lineGross / (1 + effectiveRate / 100)) : lineGross;
                subtotal += base;

                const existing = vatMap.get(effectiveRate) || { base: 0, isMedecontractant: false };
                existing.base += base;
                if (vatRegime === 'medecontractant') {
                    existing.isMedecontractant = true;
                }
                vatMap.set(effectiveRate, existing);
            }
        });
    };

    accumulate(blocks, 1);

    // Round subtotal to 2 decimals
    const roundedSubtotal = Math.round(subtotal * 100) / 100;

    // Build breakdown with rounded VAT per rate-group
    const vatBreakdown: VatBreakdownItem[] = Array.from(vatMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([rate, data]) => {
            const roundedBase = Math.round(data.base * 100) / 100;
            // Round VAT per rate-group to the cent
            const roundedVat = Math.round(roundedBase * (rate / 100) * 100) / 100;
            return {
                rate,
                base: roundedBase,
                vat: roundedVat,
                isMedecontractant: data.isMedecontractant,
            };
        });

    const totalVAT = vatBreakdown.reduce((sum, v) => sum + v.vat, 0);
    const roundedTotalVAT = Math.round(totalVAT * 100) / 100;
    const totalInclVAT = Math.round((roundedSubtotal + roundedTotalVAT) * 100) / 100;
    const hasMedecontractant = vatBreakdown.some(v => v.isMedecontractant);

    return {
        subtotal: roundedSubtotal,
        vatBreakdown,
        totalVAT: roundedTotalVAT,
        totalInclVAT,
        hasMedecontractant,
    };
}
