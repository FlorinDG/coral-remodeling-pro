/**
 * POST /api/tenant/cancel
 *
 * Initiate subscription cancellation.
 *
 * Cancellation policy:
 * - FREE: immediate (check unsettled Peppol overage first)
 * - PRO: 1 month notice, effective at start of next billing cycle
 * - ENTERPRISE: 2 months notice, effective at start of next billing cycle
 *
 * Data is preserved — modules become locked, nothing deleted.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { PLAN_PRICING, calculatePeppolOverage, getStripeInstance } from '@/lib/stripe';

export async function POST() {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                planType: true,
                billingCycle: true,
                cancellationRequestedAt: true,
                peppolSentThisMonth: true,
                peppolReceivedThisMonth: true,
                stripeSubscriptionId: true,
            },
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Already cancelling
        if (tenant.cancellationRequestedAt) {
            return NextResponse.json({ error: 'Cancellation already in progress' }, { status: 409 });
        }

        const now = new Date();

        // FREE: immediate cancellation (check for unsettled overage)
        if (tenant.planType === 'FREE') {
            const overage = await calculatePeppolOverage(tenantId);
            if (overage > 0) {
                return NextResponse.json({
                    error: `You have unsettled Peppol overage charges of €${overage.toFixed(2)}. Please settle these charges in your billing settings before cancelling.`,
                    overage,
                }, { status: 400 });
            }

            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    cancellationRequestedAt: now,
                    cancellationEffectiveAt: now,
                    subscriptionStatus: 'CANCELLED',
                },
            });

            return NextResponse.json({ effectiveAt: now.toISOString(), immediate: true });
        }

        // PRO / ENTERPRISE: notice period
        const pricing = tenant.planType === 'ENTERPRISE'
            ? PLAN_PRICING.ENTERPRISE
            : PLAN_PRICING.PRO;

        const noticeMonths = pricing.cancellationNoticeMonths;

        // Effective date = start of billing cycle + notice months
        // For simplicity: next month's 1st + notice months
        const effectiveAt = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 + noticeMonths, 1)
        );

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                cancellationRequestedAt: now,
                cancellationEffectiveAt: effectiveAt,
                cancellationNoticeMonths: noticeMonths,
            },
        });

        // Notify Stripe to cancel at period end
        if (tenant.stripeSubscriptionId) {
            try {
                const stripe = getStripeInstance();
                await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
                    cancel_at_period_end: true,
                });
            } catch (stripeError: unknown) {
                const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
                console.warn('[Cancel] Stripe subscription cancellation call failed/bypassed:', message);
                // Silent graceful degradation: log error but proceed with database update
            }
        }

        return NextResponse.json({
            effectiveAt: effectiveAt.toISOString(),
            noticeMonths,
            immediate: false,
        });
    } catch (error: unknown) {
        console.error('[Cancel]', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
