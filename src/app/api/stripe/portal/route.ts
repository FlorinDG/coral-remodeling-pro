/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for managing billing.
 * Returns { url } for client-side redirect.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getStripeInstance } from '@/lib/stripe';

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

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { stripeCustomerId: true },
        });

        if (!tenant?.stripeCustomerId) {
            return NextResponse.json(
                { error: 'No billing account found. Please upgrade first.' },
                { status: 404 }
            );
        }

        const stripe = getStripeInstance();
        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: tenant.stripeCustomerId,
            return_url: `${origin}/admin/settings/billing`,
        });

        return NextResponse.json({ url: portalSession.url });
    } catch (error: unknown) {
        console.error('[Stripe Portal]', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
