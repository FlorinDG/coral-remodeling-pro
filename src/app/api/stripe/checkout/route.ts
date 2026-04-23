/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for plan upgrade.
 * Returns { url } for client-side redirect.
 *
 * Requires STRIPE_SECRET_KEY to be configured.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as { tenantId?: string })?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { planType, billingCycle } = await req.json();

        // Stripe integration pending — return informative error
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Stripe is not yet configured. Contact support to upgrade your plan.' },
                { status: 503 }
            );
        }

        // TODO: Create Stripe Checkout Session when keys are available
        // const stripe = getStripeInstance();
        // const customerId = await getOrCreateStripeCustomer(tenantId);
        // const checkoutSession = await stripe.checkout.sessions.create({ ... });
        // return NextResponse.json({ url: checkoutSession.url });

        return NextResponse.json({ error: 'Stripe checkout not yet implemented' }, { status: 501 });
    } catch (error: unknown) {
        console.error('[Stripe Checkout]', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
