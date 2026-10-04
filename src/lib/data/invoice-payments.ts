/**
 * PAY-1 · the ONE door for payment facts and the statuses that follow from them (core, on the seraph's
 * scoped client). Callers bring a TenantScopedClient — scopeFromSession() (a user's action),
 * systemScope(tenantId, reason) (cron) — so no call can read or write another tenant's invoice,
 * whatever id it is handed. The status rule itself is pure: lib/records/invoice-payment-status.ts.
 */
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { zonedParts } from '@/lib/kernel/shift-time';
import { nextInvoiceStatus, paidTowards } from '@/lib/records/invoice-payment-status';
import type { TenantScopedClient } from '@/lib/data/scope';

/** Today in the business zone (YYYY-MM-DD) — never toISOString(), which is UTC. */
export function businessToday(now: Date = new Date()): string {
    return zonedParts(now).date;
}

type Props = Record<string, unknown>;

/**
 * Recompute one invoice's status from its linked payments (PAY-1 rule) and write it when it changes.
 * 'not_found' when the id is not an invoice OF THIS TENANT — the scoped client makes that the same thing.
 */
export async function syncInvoicePaymentStatus(
    db: TenantScopedClient,
    tenantId: string,
    invoiceId: string,
    by: string,
): Promise<'not_found' | 'unchanged' | string> {
    const invoice = await db.globalPage.findFirst({ where: { id: invoiceId, database: { logicalKey: 'invoices' } } });
    if (!invoice) return 'not_found';
    const payments = await db.globalPage.findMany({
        where: { database: { logicalKey: 'payments-in' } },
        select: { properties: true },
    });
    const props = (invoice.properties || {}) as Props;
    const paid = paidTowards(invoiceId, payments.map(p => (p.properties || {}) as Props));
    const next = nextInvoiceStatus({ status: props.status, totalIncVat: props.totalIncVat, paid, dueDate: props.dueDate, today: businessToday() });
    if (!next || next === props.status) return 'unchanged';

    await db.globalPage.update({
        where: { id: invoiceId },
        // paidDate (read by the accountant export) is set when the invoice BECOMES paid, never overwritten.
        data: { properties: { ...props, status: next, ...(next === 'opt-paid' && !props.paidDate ? { paidDate: businessToday() } : {}) } as Prisma.InputJsonValue, lastEditedBy: by },
    });
    if (next === 'opt-paid') {
        try {
            const { notify } = await import('@/lib/notifications');
            const assigneeId = invoice.assignedTo?.length ? invoice.assignedTo[0] : (invoice.createdBy || null);
            await notify({
                userId: assigneeId,
                topic: 'invoices.paid',
                title: 'Invoice Paid',
                body: `Invoice ${(props.title as string) || 'Factuur'} has been fully paid.`,
                entity: { type: 'invoice', id: invoiceId },
                href: `/nl/admin/database/db-invoices/${invoiceId}`,
            }, { tenantId, db: prisma });
        } catch (err) {
            console.error('[PAY-1] invoices.paid notification failed:', err);
        }
    }
    return next;
}
