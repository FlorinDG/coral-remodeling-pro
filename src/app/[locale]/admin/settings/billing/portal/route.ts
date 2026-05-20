/**
 * GET /[locale]/admin/settings/billing/portal
 *
 * Automatically generates a Stripe Customer Portal session and redirects
 * the user directly to the Stripe portal, then redirects them back.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getStripeInstance } from '@/lib/stripe';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ locale: string }> | { locale: string } }
) {
    // Resolve params cleanly in Next.js 15
    const resolvedParams = await params;
    const locale = resolvedParams?.locale || 'en';

    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';

        if (!tenantId) {
            return NextResponse.redirect(new URL(`/${locale}/login`, origin));
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.redirect(
                new URL(`/${locale}/admin/settings/billing?error=stripe_not_configured`, origin)
            );
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { stripeCustomerId: true },
        });

        if (!tenant?.stripeCustomerId) {
            return NextResponse.redirect(
                new URL(`/${locale}/admin/settings/billing?error=no_billing_account`, origin)
            );
        }

        const stripe = getStripeInstance();
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: tenant.stripeCustomerId,
            return_url: `${origin}/${locale}/admin/settings/billing`,
        });

        return NextResponse.redirect(portalSession.url);
    } catch (error: unknown) {
        console.error('[Stripe Portal GET Redirect]', error);
        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
        return NextResponse.redirect(
            new URL(`/${locale}/admin/settings/billing?error=portal_failed`, origin)
        );
    }
}
