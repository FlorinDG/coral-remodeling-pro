/**
 * GET /api/cron/invoice-overdue
 *
 * Daily cron job to auto-mark overdue invoices and expenses.
 * Scans all GlobalPages in db-invoices and db-expenses where:
 *   - dueDate < today
 *   - status is 'opt-sent' (invoices) or 'opt-unpaid' (expenses)
 * Sets status → 'opt-overdue'.
 *
 * Protected by CRON_SECRET header.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let invoicesUpdated = 0;
    let expensesUpdated = 0;

    try {
        // ── Invoices: opt-sent + past dueDate → opt-overdue ────────────────
        const invoiceDbs = await prisma.globalDatabase.findMany({
            where: {
                OR: [
                    { id: { startsWith: 'db-invoices' } },
                    { id: 'db-invoices' },
                ],
            },
            select: { id: true },
        });

        for (const db of invoiceDbs) {
            const pages = await prisma.globalPage.findMany({
                where: { databaseId: db.id },
                include: { database: { select: { tenantId: true } } }
            });

            for (const page of pages) {
                const props = page.properties as Record<string, any>;
                if (props.status === 'opt-sent' && props.dueDate && props.dueDate < today) {
                    await prisma.globalPage.update({
                        where: { id: page.id },
                        data: {
                            properties: { ...props, status: 'opt-overdue' },
                        },
                    });
                    
                    try {
                        const { createNotification } = await import('@/lib/notifications');
                        const invTitle = props.title || 'Factuur';
                        await createNotification({
                            tenantId: page.database.tenantId,
                            userId: null,
                            type: 'INVOICE_OVERDUE',
                            title: 'Invoice Overdue',
                            body: `Invoice ${invTitle} is overdue.`,
                            entityType: 'invoice',
                            entityId: page.id,
                            href: `/nl/admin/financials/income/invoices/${page.id}`
                        });
                    } catch (e) {
                        console.error('[Cron] Failed to emit INVOICE_OVERDUE', e);
                    }

                    invoicesUpdated++;
                }
            }
        }

        // ── Expenses: opt-unpaid + past dueDate → opt-overdue ──────────────
        const expenseDbs = await prisma.globalDatabase.findMany({
            where: {
                OR: [
                    { id: { startsWith: 'db-expenses' } },
                    { id: 'db-expenses' },
                ],
            },
            select: { id: true },
        });

        for (const db of expenseDbs) {
            const pages = await prisma.globalPage.findMany({
                where: { databaseId: db.id },
            });

            for (const page of pages) {
                const props = page.properties as Record<string, any>;
                if (props.status === 'opt-unpaid' && props.dueDate && props.dueDate < today) {
                    await prisma.globalPage.update({
                        where: { id: page.id },
                        data: {
                            properties: { ...props, status: 'opt-overdue' },
                        },
                    });
                    expensesUpdated++;
                }
            }
        }

        console.log(`[Cron] Invoice overdue check: ${invoicesUpdated} invoices, ${expensesUpdated} expenses marked overdue`);

        return NextResponse.json({
            success: true,
            invoicesUpdated,
            expensesUpdated,
            checkedAt: today,
        });
    } catch (error: unknown) {
        console.error('[Cron] Invoice overdue check failed:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
