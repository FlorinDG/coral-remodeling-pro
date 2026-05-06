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
        const tenantId = (session?.user as { tenantId?: string })?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { stripeSubscriptionId: true },
        });

        if (!tenant?.stripeSubscriptionId) {
            return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 });
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
