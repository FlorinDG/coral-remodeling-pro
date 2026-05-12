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
            select: { stripeSubscriptionId: true },
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
        
        // Notify Stripe to cancel at period end
        const subscription = (await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
            cancel_at_period_end: true,
        })) as any;

        // Update our DB
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                cancellationRequestedAt: new Date(),
                cancellationEffectiveAt: new Date(subscription.current_period_end * 1000),
            },
        });

        console.log(`[Stripe] Cancellation scheduled for tenant ${tenantId} at ${new Date(subscription.current_period_end * 1000)}`);

        return NextResponse.json({ 
            success: true, 
            effectiveAt: new Date(subscription.current_period_end * 1000).toISOString() 
        });
    } catch (error: any) {
        console.error('[Stripe Cancel Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
