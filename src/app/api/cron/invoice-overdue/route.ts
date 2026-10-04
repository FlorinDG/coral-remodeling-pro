/**
 * GET /api/cron/invoice-overdue
 *
 * Daily: a sent invoice / an unpaid expense past its due date becomes overdue (the PAY-1 rule,
 * lib/records/invoice-payment-status.ts — the same rule every payment surface uses).
 *
 * Canonical since 2026-10-04 (R2-1-CENSUS #26/#27): one tenant at a time through its own system scope —
 * the databases by their role, not by an id prefix ('db-invoices…'); "today" is the Brussels date, not UTC.
 * Protected by CRON_SECRET (one fail-closed check).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isCronRequest } from '@/lib/cron-auth';
import { platformDb, systemScope } from '@/lib/data/scope';
import { businessToday } from '@/lib/data/invoice-payments';
import { nextInvoiceStatus, nextExpenseStatus } from '@/lib/records/invoice-payment-status';

type Props = Record<string, unknown>;

export async function GET(req: Request) {
    if (!isCronRequest(req)) {                                  // R5-1: one check, fail-closed
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = businessToday();
    let invoicesUpdated = 0;
    let expensesUpdated = 0;
    const failed: string[] = [];

    const tenants = await platformDb().tenant.findMany({ select: { id: true } });
    for (const { id: tenantId } of tenants) {
        try {   // one tenant's failure never stops the others
            const db = systemScope(tenantId, 'cron: invoice-overdue');

            const invoices = await db.globalPage.findMany({ where: { database: { logicalKey: 'invoices' } } });
            for (const page of invoices) {
                const props = (page.properties || {}) as Props;
                // paid: null — the cron does not count payments; it only moves sent → overdue.
                const next = nextInvoiceStatus({ status: props.status, totalIncVat: props.totalIncVat, paid: null, dueDate: props.dueDate, today });
                if (next !== 'opt-overdue' || props.status === 'opt-overdue') continue;
                await db.globalPage.update({
                    where: { id: page.id },
                    data: { properties: { ...props, status: 'opt-overdue' }, lastEditedBy: 'system:cron-overdue' },
                });
                invoicesUpdated++;
                try {
                    const { notify } = await import('@/lib/notifications');
                    const assigneeId = page.assignedTo?.length ? page.assignedTo[0] : (page.createdBy || null);
                    await notify({
                        userId: assigneeId,
                        topic: 'invoices.overdue',
                        title: 'Invoice Overdue',
                        body: `Invoice ${(props.title as string) || 'Factuur'} is overdue.`,
                        entity: { type: 'invoice', id: page.id },
                        href: `/nl/admin/database/db-invoices/${page.id}`,
                    }, { tenantId, db: prisma });
                } catch (e) {
                    console.error('[Cron] Failed to emit INVOICE_OVERDUE', e);
                }
            }

            const expenses = await db.globalPage.findMany({ where: { database: { logicalKey: 'expenses' } } });
            for (const page of expenses) {
                const props = (page.properties || {}) as Props;
                if (nextExpenseStatus(props.status, props.dueDate, today) !== 'opt-overdue' || props.status === 'opt-overdue') continue;
                await db.globalPage.update({
                    where: { id: page.id },
                    data: { properties: { ...props, status: 'opt-overdue' }, lastEditedBy: 'system:cron-overdue' },
                });
                expensesUpdated++;
            }
        } catch (err) {
            failed.push(tenantId);
            console.error(`[Cron] invoice-overdue failed for tenant ${tenantId}:`, err);
        }
    }

    console.log(`[Cron] Invoice overdue check (${today}): ${invoicesUpdated} invoices, ${expensesUpdated} expenses marked overdue${failed.length ? `, ${failed.length} tenant(s) failed` : ''}`);
    return NextResponse.json({ success: failed.length === 0, invoicesUpdated, expensesUpdated, failedTenants: failed, checkedAt: today });
}
