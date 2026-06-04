import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getStripeInstance } from '@/lib/stripe';

/**
 * POST /api/stripe/cancel
 *
 * Sets the current Stripe subscription to cancel at the end of the current period.
 */
export async function POST() {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { stripeSubscriptionId: true, planType: true },
        });
        if (!tenant) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

        // Safety Check: Prevent cancellation if there are unsettled Peppol overage fees
        const { calculatePeppolOverage } = await import('@/lib/stripe');
        const overage = await calculatePeppolOverage(tenantId);
        if (overage > 0) {
            return NextResponse.json({ 
                error: `Cannot cancel subscription: Unsettled Peppol overage fees of €${overage.toFixed(2)} detected. These will be billed at the end of the period, but we require a manual review or payment confirmation for large overages.`,
                code: 'OVERAGE_PENDING',
                amount: overage
            }, { status: 403 });
        }

        if (!tenant.stripeSubscriptionId) {
            return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Stripe is not yet configured. Contact support.' },
                { status: 503 }
            );
        }

        const stripe = getStripeInstance();
        const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId) as any;
        
        let noticeMonths = 0;
        if (tenant.planType === 'PRO') noticeMonths = 1;
        else if (tenant.planType === 'ENTERPRISE') noticeMonths = 2;

        let effectiveDate = new Date(subscription.current_period_end * 1000);
        const noticeDate = new Date();
        noticeDate.setMonth(noticeDate.getMonth() + noticeMonths);

        // Determine cycle length in months
        const price = subscription.items.data[0]?.price;
        const interval = price?.recurring?.interval; // 'month' or 'year'
        const intervalCount = price?.recurring?.interval_count || 1;
        let cycleMonths = 1;
        if (interval === 'year') cycleMonths = 12 * intervalCount;
        else if (interval === 'month') cycleMonths = intervalCount;

        while (effectiveDate < noticeDate) {
            effectiveDate.setMonth(effectiveDate.getMonth() + cycleMonths);
        }

        const cancel_at = Math.floor(effectiveDate.getTime() / 1000);

        // Notify Stripe to cancel at the computed effective date
        const updatedSub = await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
            cancel_at,
        });

        // Update our DB
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                cancellationRequestedAt: new Date(),
                cancellationEffectiveAt: new Date(updatedSub.cancel_at! * 1000),
            },
        });

        console.log(`[Stripe] Cancellation scheduled for tenant ${tenantId} at ${new Date(updatedSub.cancel_at! * 1000)}`);

        return NextResponse.json({ 
            success: true, 
            effectiveAt: new Date(updatedSub.cancel_at! * 1000).toISOString() 
        });
    } catch (error: any) {
        console.error('[Stripe Cancel Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
