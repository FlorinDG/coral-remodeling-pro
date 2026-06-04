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
import { TRIAL_MODE_ENABLED } from '@/lib/stripe';

import { checkAndLockPastDueSubscriptions } from '@/lib/dunning';

export async function GET(req: Request) {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const dunningResult = await checkAndLockPastDueSubscriptions();
        console.log(`[Cron] Dunning check: ${dunningResult.locked} tenants locked out`);

        // PARKED 2026-05-31 — trial mode disabled (P10). Re-enable via TRIAL_MODE_ENABLED in stripe.ts.
        if (!TRIAL_MODE_ENABLED) {
            return NextResponse.json({ skippedTrials: true, reason: 'TRIAL_MODE_ENABLED is false', dunningResult });
        }

        const result = await checkAndExpireTrials();
        console.log(`[Cron] Trial check: ${result.expired} expired, ${result.reminded} reminded`);
        return NextResponse.json({ trialResult: result, dunningResult });
    } catch (error: unknown) {
        console.error('[Cron] Check failed:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
