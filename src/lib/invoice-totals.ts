import { Block } from '@/components/admin/database/types';

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
    vatCalcMode?: 'lines' | 'total';
    vatRegime?: string;
    databaseStoreState?: any;
}

export function calculateInvoiceTotals(
    blocks: Block[],
    options: CalculateTotalsOptions = {}
): InvoiceTotals {
    const { vatCalcMode = 'lines', vatRegime = '21', databaseStoreState } = options;

    let subtotal = 0;
    const vatMap = new Map<number, { base: number; isMedecontractant: boolean }>();

    const getVariantDeltas = (b: Block): number => {
        let vDeltas = 0;
        if (b.selectedVariants && b.articleId && databaseStoreState) {
            const db = databaseStoreState.databases?.find((d: any) => d.id === 'db-articles');
            const page = db?.pages.find((p: any) => p.id === b.articleId);
            const vProp = db?.properties.find((p: any) => p.type === 'variants');
            if (page && vProp) {
                const vConfig = page.properties[vProp.id];
                if (vConfig && Array.isArray(vConfig)) {
                    Object.entries(b.selectedVariants).forEach(([axisId, optId]) => {
                        const axis = vConfig.find((a: any) => a.id === axisId);
                        const opt = axis?.options.find((o: any) => o.id === optId);
                        if (opt) vDeltas += opt.priceDelta;
                    });
                }
            }
        }
        return vDeltas;
    };

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
                const lineTotal = (price + vDeltas) * nextMultiplier;
                subtotal += lineTotal;

                const lineVatRate = b.vatRate ?? 21;
                const isLineMedecontractant = !!b.vatMedecontractant;

                let effectiveRate: number;
                if (vatCalcMode === 'lines') {
                    effectiveRate = isLineMedecontractant ? 0 : lineVatRate;
                } else {
                    effectiveRate = vatRegime === 'medecontractant' ? 0 : parseFloat(vatRegime || '21');
                }

                const existing = vatMap.get(effectiveRate) || { base: 0, isMedecontractant: false };
                existing.base += lineTotal;
                if (isLineMedecontractant || (vatCalcMode === 'total' && vatRegime === 'medecontractant')) {
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
