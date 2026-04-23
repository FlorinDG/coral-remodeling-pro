/**
 * GET /api/cron/trial-check
 *
 * Vercel Cron job (runs daily) to:
 * 1. Send 7-day trial expiry reminders
 * 2. Auto-downgrade expired trials to FREE
 *
 * Protected by CRON_SECRET header.
 */

import { NextResponse } from 'next/server';
import { checkAndExpireTrials } from '@/lib/trial';

export async function GET(req: Request) {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await checkAndExpireTrials();
        console.log(`[Cron] Trial check: ${result.expired} expired, ${result.reminded} reminded`);
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('[Cron] Trial check failed:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
