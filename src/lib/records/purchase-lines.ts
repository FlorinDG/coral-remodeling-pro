/**
 * LINES-1 · a purchase document's LINES — what a reading (scan or Peppol) found, as the editor's line rows (Florin
 * 2026-10-07: "remove the vat from the line input, it is only calculated at the end, and add discount instead, useful
 * information that i can import in the library, the bruto price, the discount"). Pure, tested (tests/purchase-lines.test.ts).
 *
 * A line keeps: the GROSS unit price (bruto, before discount), the line discount %, the net line total (excl. VAT), the
 * supplier's article code — what the library import needs. The VAT rate stays on the line, HIDDEN: the accountant
 * export splits VAT per rate from it; VAT is shown only in the totals.
 * Found: the scan never turned its lines into rows at all (they lay as a JSON text field) and Peppol kept the net price
 * only — no gross price, no discount, no article code.
 */
export interface ReadLine {
    description?: string | null; quantity?: number | null; unitCode?: string | null;
    unitPrice?: number | null;        // as read: the price per unit (a reader may give the gross or the net price)
    grossUnitPrice?: number | null;   // the price BEFORE discount, when the document names it
    discountPercent?: number | null; vatRate?: number | null; lineTotal?: number | null; articleCode?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The net line total — quantity × gross price × (1 − discount). */
export function lineNet(quantity: number, grossUnitPrice: number, discountPct: number): number {
    return round2((quantity || 0) * (grossUnitPrice || 0) * (1 - (discountPct || 0) / 100));
}

/** One read line → its row properties. A discount not stated but visible in the numbers (gross × qty > total) is derived. */
export function lineProperties(l: ReadLine): Record<string, unknown> {
    const quantity = num(l.quantity) ?? 1;
    const gross = num(l.grossUnitPrice) ?? num(l.unitPrice) ?? 0;
    const total = num(l.lineTotal);
    let discount = num(l.discountPercent);
    if (discount === null && total !== null && gross > 0 && quantity > 0 && total < quantity * gross * 0.995) {
        discount = round2((1 - total / (quantity * gross)) * 100);
    }
    return {
        quantity, unitCode: l.unitCode || 'C62', unitPrice: gross, discountPct: discount ?? 0,
        vatRate: num(l.vatRate) ?? 0,
        lineTotal: total ?? lineNet(quantity, gross, discount ?? 0),
        ...(l.articleCode ? { articleCode: String(l.articleCode).trim() } : {}),
        margePercent: 0,
    };
}

/** The read lines as the document's line rows (financial-row blocks). */
export function purchaseLineBlocks(lines: ReadLine[] | null | undefined, newId: () => string): Array<Record<string, unknown>> {
    return (lines || []).map((l, order) => ({ id: newId(), type: 'financial-row', content: String(l.description || ''), order, properties: lineProperties(l) }));
}
