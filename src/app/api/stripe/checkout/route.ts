/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for plan upgrade.
 * Returns { url } for client-side redirect.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStripeInstance, getOrCreateStripeCustomer, getPriceId, PLAN_PRICING } from '@/lib/stripe';
import { startTrial } from '@/lib/trial';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as { tenantId?: string })?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Stripe is not yet configured. Contact support to upgrade your plan.' },
                { status: 503 }
            );
        }

        const { planType, billingCycle } = await req.json();

        if (!planType || !['PRO', 'ENTERPRISE'].includes(planType)) {
            return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
        }

        const stripe = getStripeInstance();
        const customerId = await getOrCreateStripeCustomer(tenantId);

        // Determine the base price
        const priceKey = planType === 'ENTERPRISE' ? 'ENT_MONTHLY' : 'PRO_MONTHLY';
        const priceId = getPriceId(priceKey);

        // Determine trial days
        const pricing = planType === 'ENTERPRISE' ? PLAN_PRICING.ENTERPRISE : PLAN_PRICING.PRO;
        const trialDays = pricing.trialMonths * 30;

        // Build line items — base plan
        const lineItems: { price: string; quantity: number }[] = [
            { price: priceId, quantity: 1 },
        ];

        // Build success/cancel URLs
        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
        const successUrl = `${origin}/admin/settings/billing?session_id={CHECKOUT_SESSION_ID}&status=success`;
        const cancelUrl = `${origin}/admin/settings/billing?status=cancelled`;

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: lineItems,
            subscription_data: {
                trial_period_days: trialDays,
                metadata: { tenantId, planType, billingCycle: billingCycle || 'MONTHLY' },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { tenantId, planType },
        });

        // Start trial tracking in our DB
        await startTrial(tenantId, planType);

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error: unknown) {
        console.error('[Stripe Checkout]', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
