/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle.
 * Secured via STRIPE_WEBHOOK_SECRET signature verification.
 *
 * Events handled:
 * - checkout.session.completed  → provision plan upgrade
 * - customer.subscription.updated → plan/seat changes
 * - customer.subscription.deleted → downgrade to FREE
 * - invoice.payment_failed → PAST_DUE status
 * - invoice.paid → clear PAST_DUE
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeInstance, syncPlanToTenant, STRIPE_PRICE_IDS } from '@/lib/stripe';

export async function POST(req: Request) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured — skipping');
        return NextResponse.json({ received: false, error: 'Webhook secret not configured' }, { status: 503 });
    }

    const stripe = getStripeInstance();
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
        console.error('[Stripe Webhook] Signature verification failed:', err);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    console.log(`[Stripe Webhook] Received: ${event.type}`);

    try {
        switch (event.type) {
            // ── Checkout completed — provision subscription ──────────
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const tenantId = session.metadata?.tenantId;
                const planType = session.metadata?.planType || 'PRO';

                if (!tenantId) {
                    console.warn('[Stripe Webhook] checkout.session.completed missing tenantId metadata');
                    break;
                }

                // Retrieve the subscription to get IDs
                const subscriptionId = typeof session.subscription === 'string'
                    ? session.subscription
                    : session.subscription?.id;

                if (subscriptionId) {
                    const sub = await stripe.subscriptions.retrieve(subscriptionId);
                    await syncPlanToTenant(tenantId, planType, {
                        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
                        stripeSubscriptionId: sub.id,
                        stripePriceId: sub.items.data[0]?.price?.id,
                        subscriptionStatus: sub.status === 'trialing' ? 'TRIAL' : 'ACTIVE',
                        billingCycle: session.metadata?.billingCycle || 'MONTHLY',
                    });
                }

                console.log(`[Stripe Webhook] Provisioned ${planType} for tenant ${tenantId}`);
                break;
            }

            // ── Subscription updated — plan/seat changes ────────────
            case 'customer.subscription.updated': {
                const sub = event.data.object as Stripe.Subscription;
                const tenantId = sub.metadata?.tenantId;

                if (!tenantId) break;

                // Map subscription status
                let status = 'ACTIVE';
                if (sub.status === 'trialing') status = 'TRIAL';
                else if (sub.status === 'past_due') status = 'PAST_DUE';
                else if (sub.status === 'canceled') status = 'CANCELLED';

                // Determine plan type from price
                const priceId = sub.items.data[0]?.price?.id;
                const planType = sub.metadata?.planType || determinePlanFromPrice(priceId);

                await syncPlanToTenant(tenantId, planType, {
                    stripeSubscriptionId: sub.id,
                    stripePriceId: priceId,
                    subscriptionStatus: status,
                });

                console.log(`[Stripe Webhook] Updated subscription for tenant ${tenantId}: ${status}`);
                break;
            }

            // ── Subscription deleted — downgrade to FREE ────────────
            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription;
                const tenantId = sub.metadata?.tenantId;

                if (!tenantId) break;

                await syncPlanToTenant(tenantId, 'FREE', {
                    subscriptionStatus: 'CANCELLED',
                });

                console.log(`[Stripe Webhook] Subscription deleted — tenant ${tenantId} downgraded to FREE`);
                break;
            }

            // ── Payment failed — mark PAST_DUE ──────────────────────
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = typeof invoice.customer === 'string'
                    ? invoice.customer
                    : invoice.customer?.id;

                if (customerId) {
                    const { default: prisma } = await import('@/lib/prisma');
                    await prisma.tenant.updateMany({
                        where: { stripeCustomerId: customerId },
                        data: { subscriptionStatus: 'PAST_DUE' },
                    });
                    console.log(`[Stripe Webhook] Payment failed for customer ${customerId} — marked PAST_DUE`);
                }
                break;
            }

            // ── Payment succeeded — clear PAST_DUE ──────────────────
            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = typeof invoice.customer === 'string'
                    ? invoice.customer
                    : invoice.customer?.id;

                if (customerId) {
                    const { default: prisma } = await import('@/lib/prisma');
                    await prisma.tenant.updateMany({
                        where: { stripeCustomerId: customerId, subscriptionStatus: 'PAST_DUE' },
                        data: { subscriptionStatus: 'ACTIVE' },
                    });
                    console.log(`[Stripe Webhook] Payment succeeded for customer ${customerId} — cleared PAST_DUE`);
                }
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        console.error('[Stripe Webhook] Handler error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── Helper: determine plan type from price ID ───────────────────────
function determinePlanFromPrice(priceId: string | undefined): string {
    if (!priceId) return 'PRO';

    const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    const env = isTest ? 'test' : 'prod';

    for (const [key, ids] of Object.entries(STRIPE_PRICE_IDS)) {
        if (ids[env] === priceId) {
            return key.includes('ENT') ? 'ENTERPRISE' : 'PRO';
        }
    }

    return 'PRO';
}
