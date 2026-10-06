/**
 * SCAN-1 · what a document READING may write (Florin 2026-10-06: "all the receipts that are named expense and there is
 * just a simple blob link"). Pure, tested (tests/scan-reading.test.ts).
 *
 * Found: when the reader's answer could not be parsed, the scan went on with an EMPTY reading and saved it as a
 * success — title "Expense", amount 0, and TODAY's date (UTC). The record then claimed a date and an amount nobody
 * read. Now: an empty reading is a FAILED reading (the record keeps its file name and is "Na te kijken" with the
 * reason), and a partial reading writes only what it read — never an invented date, amount or title.
 */
export interface Reading {
    merchant?: string | null; date?: string | null; totalAmount?: number | null; category?: string | null;      // ticket
    supplierName?: string | null; invoiceNumber?: string | null; issueDate?: string | null; totalIncVat?: number | null;   // invoice
}

const has = (v: unknown) => v !== undefined && v !== null && v !== '';

/** Nothing usable was read — the reading failed, whatever the reader returned. */
export function isEmptyReading(r: Reading | null | undefined, isInvoice: boolean): boolean {
    if (!r) return true;
    return isInvoice
        ? !has(r.supplierName) && !has(r.invoiceNumber) && !has(r.issueDate) && !has(r.totalIncVat)
        : !has(r.merchant) && !has(r.date) && !has(r.totalAmount);
}

/** A ticket's fields from a reading: only what was read; what is missing is named in the review reason. */
export function ticketFields(r: Reading): Record<string, unknown> {
    const missing = [!has(r.merchant) && 'handelaar', !has(r.date) && 'datum', !has(r.totalAmount) && 'bedrag'].filter(Boolean);
    return {
        ...(has(r.merchant) ? { title: r.merchant } : {}),
        ...(has(r.date) ? { date: r.date } : {}),
        ...(has(r.totalAmount) ? { amount: r.totalAmount } : {}),
        ...(has(r.category) ? { category: r.category } : {}),
        reviewStatus: 'Na te kijken',
        reviewReason: missing.length ? `Niet gelezen: ${missing.join(', ')}` : '',
    };
}
