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
    const isoStr = format(new Date(), 'yyyy-MM-dd');   // Matches Grid DateColumn format
    const reminderFlag = '🔔';
    let remindersSent = 0;

    try {
        const pages = await prisma.globalPage.findMany({
            include: { database: { select: { tenantId: true } } }
        });

        const { createNotification } = await import('@/lib/notifications');

        for (const page of pages) {
            // Check if blocks or properties contain the date string
            const pageText = JSON.stringify({ props: page.properties, blocks: page.blocks });
            
            const hasMentionReminder = pageText.includes(`${todayStr} ${reminderFlag}`);
            const hasGridReminder = pageText.includes(`${isoStr} ${reminderFlag}`);
            
            if (hasMentionReminder || hasGridReminder) {
                // Determine a title for the notification
                const props = page.properties as any;
                const title = props?.title || props?.name || 'Item';
                
                const href = `/nl/admin/database/${page.databaseId}/${page.id}`;
                
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

        // Process Task Email Digest Reminders (TASK-M15)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowIso = format(tomorrow, 'yyyy-MM-dd');

        const { sendTaskDigestEmail } = await import('@/lib/email');

        // Group tasks by tenant for email digest
        const tenantTaskMap = new Map<string, { to: string; tasks: any[] }>();

        for (const page of pages) {
            const props = (page.properties as Record<string, any>) || {};
            const status = props['prop-task-status'];
            if (status === 'opt-done' || status === 'opt-dropped' || status === 't-done') continue;

            const rem = props['prop-task-reminder'];
            const due = props['prop-task-due'];
            if (!rem || rem === 'opt-rem-none' || !due) continue;

            const firesToday = (rem === 'opt-rem-morning' && due === isoStr) ||
                               (rem === 'opt-rem-day-before' && due === tomorrowIso);

            if (firesToday) {
                const tenantId = page.database.tenantId;
                if (!tenantTaskMap.has(tenantId)) {
                    // Fetch tenant owner email
                    const tenantOwner = await prisma.user.findFirst({
                        where: { tenantId, role: { in: ['admin', 'owner'] } },
                        select: { email: true, name: true }
                    });
                    if (tenantOwner?.email) {
                        tenantTaskMap.set(tenantId, { to: tenantOwner.email, tasks: [] });
                    }
                }
                const entry = tenantTaskMap.get(tenantId);
                if (entry) {
                    entry.tasks.push({
                        id: page.id,
                        title: props.title || 'Untitled Task',
                        due,
                        priority: props['prop-task-priority'],
                    });
                }
            }
        }

        for (const [, { to, tasks }] of tenantTaskMap) {
            if (tasks.length > 0) {
                await sendTaskDigestEmail({ to, tasks });
                remindersSent += tasks.length;
            }
        }

        return NextResponse.json({ success: true, remindersSent });
    } catch (e: any) {
        console.error('[Cron] Failed to process date reminders', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
