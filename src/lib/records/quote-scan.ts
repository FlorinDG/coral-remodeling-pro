/**
 * QUOTE-IN-1 · what a READ supplier quote becomes on its record. Pure, tested (tests/quote-scan.test.ts).
 * The reading is the invoice reading (supplier, number, date, totals, lines — lines are built by purchase-lines);
 * this maps it to the quote's fields (kernel db-purchase-quotes). Only what was read; a re-scan never resets what a
 * person set (status, notes).
 */
export interface QuoteReading {
    supplierName?: string | null;
    supplierVat?: string | null;
    invoiceNumber?: string | null;
    issueDate?: string | null;
    dueDate?: string | null;
    totalExVat?: number | null;
    totalVat?: number | null;
    totalIncVat?: number | null;
    lines?: Array<{ description?: string | null }> | null;
}

export const QUOTE_RECEIVED = 'qs-received';

export function quoteScanProperties(r: QuoteReading, ctx: { fileName?: string; isNew: boolean }): Record<string, unknown> {
    const missing: string[] = [];
    if (!r.supplierName) missing.push('leverancier');
    if (!r.issueDate) missing.push('datum');
    if (r.totalExVat == null && r.totalIncVat == null) missing.push('totaal');
    return {
        // the quote number read, else (a new record) its file name — never an invented title
        ...(r.invoiceNumber ? { title: r.invoiceNumber } : ctx.isNew ? { title: ctx.fileName || 'Offerte' } : {}),
        ...(ctx.isNew ? { quoteStatus: QUOTE_RECEIVED } : {}),
        source: 'src-scan',
        ...(r.supplierName ? { supplierName: r.supplierName } : {}),
        ...(r.supplierVat ? { supplierVat: r.supplierVat } : {}),
        ...(r.issueDate ? { invoiceDate: r.issueDate } : {}),
        ...(r.dueDate ? { validUntil: r.dueDate } : {}),
        ...(r.totalExVat != null ? { totalExVat: r.totalExVat } : {}),
        ...(r.totalVat != null ? { totalVat: r.totalVat } : {}),
        ...(r.totalIncVat != null ? { totalIncVat: r.totalIncVat } : {}),
        ...(r.lines?.[0]?.description ? { betreft: r.lines[0].description } : {}),
        reviewStatus: missing.length ? 'Na te kijken' : 'Klaar',
        reviewReason: missing.length ? `Ontbreekt: ${missing.join(', ')}` : '',
    };
}
