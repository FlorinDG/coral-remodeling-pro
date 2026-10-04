/**
 * PAY-1 · the ONE rule for an invoice's / expense's payment status — pure, tested
 * (tests/invoice-payment-status.test.ts). Every surface that changes it — a matched bank payment, a
 * Stripe payment, the overdue cron — asks this; none decides on its own.
 *
 * Florin 2026-10-04: "make sure no leak can occur at the level where we cash in, and the statuses that
 * incur from that … a host of surfaces that overlap." Before: Stripe set opt-paid outright (any amount),
 * payment matching computed it from payments, the cron set opt-overdue — three writers, three rules.
 *
 * The semantics are TODAY's, kept exactly — only collected here:
 *   - linked payments cover the total (> 0)              → opt-paid
 *   - sent and past the due date (Brussels date)         → opt-overdue
 *   - everything else                                    → unchanged
 * A status a PERSON set is never undone: paid stays paid (invoices marked paid by hand have no payment
 * rows), and credited / uncollectible are never touched. A payment is a FACT (a payments-in row); the
 * status follows from the facts — a €1 payment cannot make a €1,000 invoice paid.
 */

/** Statuses only a person sets — no automatic transition leaves them. */
const HUMAN_FINAL = new Set(['opt-paid', 'opt-credited', 'opt-partially-credited', 'opt-uncollectible']);

export interface InvoiceStatusInput {
    status: unknown;
    totalIncVat: unknown;
    /** Sum of the payments linked to this invoice, or null when the caller did not count them (the cron). */
    paid: number | null;
    dueDate: unknown;
    /** YYYY-MM-DD in the business zone (kernel zonedParts) — never toISOString(). */
    today: string;
}

export function nextInvoiceStatus(i: InvoiceStatusInput): string | null {
    const status = typeof i.status === 'string' ? i.status : null;
    if (status && HUMAN_FINAL.has(status)) return status;
    const total = typeof i.totalIncVat === 'number' ? i.totalIncVat : Number(i.totalIncVat);
    if (i.paid !== null && Number.isFinite(total) && total > 0 && i.paid + 0.005 >= total) return 'opt-paid';
    if (status === 'opt-sent' && typeof i.dueDate === 'string' && i.dueDate && i.dueDate < i.today) return 'opt-overdue';
    return status;
}

/** Purchase invoices / expenses: unpaid and past the due date → overdue. Nothing else is automatic. */
export function nextExpenseStatus(status: unknown, dueDate: unknown, today: string): string | null {
    const s = typeof status === 'string' ? status : null;
    if (s === 'opt-unpaid' && typeof dueDate === 'string' && dueDate && dueDate < today) return 'opt-overdue';
    return s;
}

/** The invoice ids a payments-in row is linked to (relation stored as an array, or a bare id). */
export function linkedInvoiceId(paymentProps: Record<string, unknown>): string | null {
    const v = paymentProps.invoice;
    if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null;
    return typeof v === 'string' && v ? v : null;
}

/** Sum of the amounts of the payments linked to `invoiceId`. */
export function paidTowards(invoiceId: string, payments: Array<Record<string, unknown>>): number {
    let sum = 0;
    for (const p of payments) {
        if (linkedInvoiceId(p) === invoiceId && typeof p.amount === 'number' && Number.isFinite(p.amount)) sum += p.amount;
    }
    return Math.round(sum * 100) / 100;
}
