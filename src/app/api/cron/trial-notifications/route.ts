import { NextResponse } from 'next/server';
import { checkAndExpireTrials } from '@/lib/trial';

/**
 * GET /api/cron/trial-notifications
 *
 * Daily cron job to:
 * 1. Send 7-day trial expiry reminders.
 * 2. Auto-downgrade expired trials to FREE.
 * 3. Send trial-expired notifications.
 *
 * Protected by CRON_SECRET environment variable.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting trial notification scan...');
        const stats = await checkAndExpireTrials();
        console.log(`[Cron] Scan complete: ${stats.reminded} reminders sent, ${stats.expired} trials expired.`);
        
        return NextResponse.json({ 
            success: true, 
            message: 'Trial notification scan complete',
            ...stats
        });
    } catch (error: any) {
        console.error('[Cron] Trial notification error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
