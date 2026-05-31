/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for plan upgrade.
 * Returns { url } for client-side redirect.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getStripeInstance, getOrCreateStripeCustomer, getPriceId, PLAN_PRICING, TRIAL_MODE_ENABLED } from '@/lib/stripe';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
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

        // Build line items — base plan + seats
        const lineItems: { price: string; quantity: number }[] = [
            { price: priceId, quantity: 1 },
        ];

        // Fetch current tenant seat counts from database to include them in checkout
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { extraUserCount: true, workforceUserCount: true }
        });

        if (tenant) {
            const extraUserKey = planType === 'ENTERPRISE' ? 'EXTRA_USER_ENT' : 'EXTRA_USER_PRO';
            const workforceKey = planType === 'ENTERPRISE' ? 'WORKFORCE_ENT' : 'WORKFORCE_PRO';

            if (tenant.extraUserCount > 0) {
                lineItems.push({
                    price: getPriceId(extraUserKey),
                    quantity: tenant.extraUserCount
                });
            }
            if (tenant.workforceUserCount > 0) {
                lineItems.push({
                    price: getPriceId(workforceKey),
                    quantity: tenant.workforceUserCount
                });
            }
        }

        // Build success/cancel URLs
        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
        const successUrl = `${origin}/admin/settings/billing?session_id={CHECKOUT_SESSION_ID}&status=success`;
        const cancelUrl = `${origin}/admin/settings/billing?status=cancelled`;

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: lineItems,
            subscription_data: {
                // PARKED 2026-05-31 — trial disabled (P10). Re-enable via TRIAL_MODE_ENABLED.
                // When off: immediate charge on upgrade (no trial), tenant goes straight to ACTIVE.
                ...(TRIAL_MODE_ENABLED ? { trial_period_days: trialDays } : {}),
                metadata: { tenantId, planType, billingCycle: billingCycle || 'MONTHLY' },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { tenantId, planType },
        });


        return NextResponse.json({ url: checkoutSession.url });
    } catch (error: unknown) {
        console.error('[Stripe Checkout]', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
