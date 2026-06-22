import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = format(new Date(), 'dd/MM/yyyy'); // Matches GlobalMentionDateInterceptor format
    let remindersSent = 0;

    try {
        const pages = await prisma.globalPage.findMany({
            include: { database: { select: { tenantId: true } } }
        });

        const { createNotification } = await import('@/lib/notifications');

        for (const page of pages) {
            // Check if blocks or properties contain the date string
            const pageText = JSON.stringify({ props: page.properties, blocks: page.blocks });
            if (pageText.includes(todayStr)) {
                // Determine a title for the notification
                const props = page.properties as any;
                const title = props?.title || props?.name || 'Item';
                
                // Determine href
                let href = `/admin/dashboard`; // Default fallback
                const dbId = page.databaseId;
                if (dbId.includes('db-invoices')) href = `/admin/financials/income/invoices/${page.id}`;
                else if (dbId.includes('db-clients')) href = `/admin/contacts/clients/${page.id}`;
                else if (dbId.includes('db-suppliers')) href = `/admin/contacts/suppliers/${page.id}`;
                else if (dbId.includes('db-expenses')) href = `/admin/financials/expenses/invoices/${page.id}`;
                else if (dbId.includes('db-quotations')) href = `/admin/financials/income/quotations/${page.id}`;
                
                await createNotification({
                    tenantId: page.database.tenantId,
                    userId: null,
                    type: 'DATE_REMINDER',
                    title: 'Date Reminder',
                    body: `Reminder for ${title} on ${todayStr}`,
                    entityType: 'page',
                    entityId: page.id,
                    href
                });

                remindersSent++;
            }
        }

        return NextResponse.json({ success: true, remindersSent });
    } catch (e: any) {
        console.error('[Cron] Failed to process date reminders', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
