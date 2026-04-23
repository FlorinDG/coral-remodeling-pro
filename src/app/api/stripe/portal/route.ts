/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for managing billing.
 * Returns { url } for client-side redirect.
 *
 * Requires STRIPE_SECRET_KEY to be configured.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST() {
    try {
        const session = await auth();
        const tenantId = (session?.user as { tenantId?: string })?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Stripe is not yet configured. Contact support to manage your billing.' },
                { status: 503 }
            );
        }

        // TODO: Create Stripe Customer Portal session when keys are available
        // const stripe = getStripeInstance();
        // const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { stripeCustomerId: true } });
        // const portalSession = await stripe.billingPortal.sessions.create({ customer: tenant.stripeCustomerId, return_url: ... });
        // return NextResponse.json({ url: portalSession.url });

        return NextResponse.json({ error: 'Stripe portal not yet implemented' }, { status: 501 });
    } catch (error: unknown) {
        console.error('[Stripe Portal]', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
