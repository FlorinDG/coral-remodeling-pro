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
import { formatEuro } from './grid-cell';
type Props = Record<string, unknown>;

const TICKET_FROM_VIEW: Readonly<Record<string, string>> = { supplierName: 'title', invoiceDate: 'date', totalIncVat: 'amount' };
/** The ticket's own fields the editor may write (kernel db-tickets + the review fields). */
const TICKET_FIELDS: ReadonlySet<string> = new Set([
    'date', 'amount', 'category', 'currency', 'paymentMethod', 'notes', 'project', 'receiptUrl', 'costType',
    'vatDeductiblePct', 'reviewStatus', 'reviewReason', 'duplicateOf',
]);

/** The databases whose records ARE purchase documents — they open in the one purchase editor (EDIT-1), never in the
 *  generic record panel. */
export function isPurchaseDocumentRole(role: string | null | undefined): boolean {
    return role === 'expenses' || role === 'tickets' || role === 'purchase-quotes';
}

/** The purchase documents that are COSTS — validated before they count (VALIDATE-1). A supplier quote is not. */
export function needsValidation(role: string | null | undefined): boolean {
    return role === 'expenses' || role === 'tickets';
}

// QUOTE-IN-1 · a supplier's quote in the same editor: the invoice's facts under the same ids, its "due date" is the
// quote's validity, its status its own select (no payment flow, no accounting, no Peppol).
const QUOTE_FROM_VIEW: Readonly<Record<string, string>> = { dueDate: 'validUntil' };
const QUOTE_EDITOR: ReadonlySet<string> = new Set([
    'supplierName', 'supplierVat', 'contact', 'betreft', 'ourRef', 'invoiceDate', 'dueDate', 'quoteStatus',
    'totalExVat', 'totalVat', 'totalIncVat', 'lines', 'project', 'notes',
]);
const QUOTE_LABEL: Readonly<Record<string, string>> = { invoiceDate: 'Offertedatum', dueDate: 'Geldig tot', details: 'Offerte', paymentNotes: 'Opmerkingen' };

/** A record as the editor reads it. Purchase invoices: unchanged. Tickets: their facts under the editor's names. */
export function purchaseView(role: string | null | undefined, props: Props): Props {
    if (role === 'purchase-quotes') return { ...props, dueDate: props.validUntil ?? '' };
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
    if (role === 'purchase-quotes') {
        if (key in QUOTE_FROM_VIEW) return { key: QUOTE_FROM_VIEW[key], value };
        return QUOTE_EDITOR.has(key) || ['title', 'supplier', 'receiptUrl', 'reviewStatus', 'reviewReason'].includes(key) ? { key, value } : null;
    }
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
    if (role === 'purchase-quotes') return QUOTE_EDITOR.has(field);
    if (field === 'quoteStatus') return false;
    return role !== 'tickets' || TICKET_EDITOR.has(field);
}

/** The label a field carries for this kind of document (a ticket's "supplier" is its merchant). */
const TICKET_LABEL: Readonly<Record<string, string>> = { supplierName: 'Handelaar', invoiceDate: 'Datum', totalIncVat: 'Bedrag' };

export function editorLabel(role: string | null | undefined, field: string, invoiceLabel: string): string {
    if (role === 'purchase-quotes') return QUOTE_LABEL[field] ?? invoiceLabel;
    return role === 'tickets' ? (TICKET_LABEL[field] ?? invoiceLabel) : invoiceLabel;
}

/**
 * What a reading found, in one line — "Brico · 02/10/2026 · € 12,50" (Florin 2026-10-07: the import "does not show any
 * sort of info on the imported doc, just confirms"). Belgian date, euro amount; only what is there.
 */
export function readingSummary(role: string | null | undefined, props: Props): string {
    const v = purchaseView(role, props);
    const who = String(v.supplierName ?? '').trim();
    const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v.invoiceDate ?? ''));
    const n = Number(v.totalIncVat);
    const amount = v.totalIncVat !== '' && v.totalIncVat !== null && v.totalIncVat !== undefined && Number.isFinite(n)
        ? formatEuro(n) : '';
    return [who, d ? `${d[3]}/${d[2]}/${d[1]}` : '', amount].filter(Boolean).join(' · ');
}
