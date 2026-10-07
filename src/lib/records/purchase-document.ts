/**
 * EDIT-1 · ONE side-by-side editor for every purchase document — purchase invoices AND tickets (Florin 2026-10-07:
 * "the only way i have to manually correct the information is in that modal … I have to see them side by side").
 * Pure, tested (tests/purchase-document.test.ts).
 *
 * The editor (PurchaseInvoiceEngine) speaks the purchase-invoice vocabulary: supplierName, invoiceDate, totalIncVat.
 * A ticket keeps the same facts under its own fields: title (the merchant), date, amount. Found: mobile already opened
 * tickets in that editor — a corrected date / amount was written to invoiceDate / totalIncVat, fields no ticket screen,
 * approval check or export reads. Now the editor READS a ticket through `purchaseView` and WRITES through
 * `purchaseWrite`: every change lands in the ticket's own field; a field a ticket does not have is never written.
 */
type Props = Record<string, unknown>;

const TICKET_FROM_VIEW: Readonly<Record<string, string>> = { supplierName: 'title', invoiceDate: 'date', totalIncVat: 'amount' };
/** The ticket's own fields the editor may write (kernel db-tickets + the review fields). */
const TICKET_FIELDS: ReadonlySet<string> = new Set([
    'date', 'amount', 'category', 'currency', 'paymentMethod', 'notes', 'project', 'receiptUrl', 'costType',
    'vatDeductiblePct', 'reviewStatus', 'reviewReason',
]);

/** A record as the editor reads it. Purchase invoices: unchanged. Tickets: their facts under the editor's names. */
export function purchaseView(role: string | null | undefined, props: Props): Props {
    if (role !== 'tickets') return props;
    const amount = props.amount;
    return {
        ...props,
        // title stays the merchant (the editor's header); an edit of `title` never reaches a ticket — supplierName does
        supplierName: props.title ?? '',
        invoiceDate: props.date ?? '',
        totalIncVat: amount ?? '',
        totalExVat: amount ?? '',        // a ticket carries no VAT split (vatDeductiblePct)
        totalVat: 0,
    };
}

/** Where an edit in the editor lands — the record's own field, or null (a field this kind of document does not have). */
export function purchaseWrite(role: string | null | undefined, key: string, value: unknown): { key: string; value: unknown } | null {
    if (role !== 'tickets') return { key, value };
    if (key in TICKET_FROM_VIEW) return { key: TICKET_FROM_VIEW[key], value };
    return TICKET_FIELDS.has(key) ? { key, value } : null;
}

/**
 * What the editor SHOWS for this kind of document (Florin 2026-10-07: "the fields not applicable remove, we don't need
 * a crippled copy of the invoice modal"). Field ids in the editor's vocabulary. Purchase invoices: everything. Tickets:
 * what a ticket is — merchant, date, amount, its category, currency, payment method, project, notes. No VAT number,
 * OGM, IBAN, due date, cost type, ledger account, VAT regime, payment date, line items or Peppol actions.
 */
const TICKET_EDITOR: ReadonlySet<string> = new Set(['supplierName', 'invoiceDate', 'totalIncVat', 'category', 'currency', 'paymentMethod', 'project', 'notes']);

export function editorShows(role: string | null | undefined, field: string): boolean {
    return role !== 'tickets' || TICKET_EDITOR.has(field);
}

/** The label a field carries for this kind of document (a ticket's "supplier" is its merchant). */
const TICKET_LABEL: Readonly<Record<string, string>> = { supplierName: 'Handelaar', invoiceDate: 'Datum', totalIncVat: 'Bedrag' };

export function editorLabel(role: string | null | undefined, field: string, invoiceLabel: string): string {
    return role === 'tickets' ? (TICKET_LABEL[field] ?? invoiceLabel) : invoiceLabel;
}
