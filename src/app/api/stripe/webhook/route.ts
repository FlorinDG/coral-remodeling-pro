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
import { getStripeInstance, syncPlanToTenant, STRIPE_PRICE_IDS, getPriceId } from '@/lib/stripe';

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
        console.log('[Stripe Webhook] Signature verification failed. Trying fallback for tenant checkout session.');
        try {
            const rawEvent = JSON.parse(body);
            if (rawEvent && rawEvent.type === 'checkout.session.completed') {
                const session = rawEvent.data?.object as Stripe.Checkout.Session;
                const tenantId = session?.metadata?.tenantId;
                const invoiceId = session?.metadata?.invoiceId;
                if (tenantId && invoiceId) {
                    const { default: prisma } = await import('@/lib/prisma');
                    const tenant = await prisma.tenant.findUnique({
                        where: { id: tenantId }
                    });
                    if (tenant && tenant.paymentProvider === 'stripe' && tenant.stripeSecretKey) {
                        const { decrypt } = await import('@/lib/encryption');
                        const decryptedKey = decrypt(tenant.stripeSecretKey);
                        if (decryptedKey) {
                            const tenantStripe = new Stripe(decryptedKey, {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                apiVersion: '2022-11-15' as any
                            });
                            const verifiedSession = await tenantStripe.checkout.sessions.retrieve(session.id);
                            if (verifiedSession && verifiedSession.payment_status === 'paid') {
                                event = {
                                    id: rawEvent.id || 'evt_constructed',
                                    object: 'event',
                                    api_version: rawEvent.api_version,
                                    created: rawEvent.created,
                                    livemode: rawEvent.livemode,
                                    pending_webhooks: rawEvent.pending_webhooks,
                                    request: rawEvent.request,
                                    type: 'checkout.session.completed',
                                    data: {
                                        object: verifiedSession
                                    }
                                } as unknown as Stripe.Event;
                                console.log('[Stripe Webhook] Verification succeeded via tenant Stripe API fetch.');
                            } else {
                                throw new Error('Retrieved checkout session was not paid');
                            }
                        } else {
                            throw new Error('Tenant Stripe key decryption failed');
                        }
                    } else {
                        throw new Error('Tenant payment provider is not stripe or Stripe key is missing');
                    }
                } else {
                    throw new Error('Missing tenantId or invoiceId in metadata');
                }
            } else {
                throw err;
            }
        } catch (fallbackErr) {
            console.error('[Stripe Webhook] Signature verification and fallback verification failed:', fallbackErr);
            return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
        }
    }

    console.log(`[Stripe Webhook] Received: ${event.type}`);

    try {
        switch (event.type) {
            // ── Checkout completed — provision subscription ──────────
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const tenantId = session.metadata?.tenantId;
                const invoiceId = session.metadata?.invoiceId;

                if (invoiceId) {
                    const { default: prisma } = await import('@/lib/prisma');
                    const page = await prisma.globalPage.findUnique({
                        where: { id: invoiceId }
                    });
                    if (page) {
                        const props = page.properties as Record<string, unknown>;
                        const today = new Date().toISOString().split('T')[0];
                        const updatedProps = {
                            ...props,
                            status: 'opt-paid',
                            paidDate: today,
                            paymentMethod: 'pay-card'
                        };
                        await prisma.globalPage.update({
                            where: { id: invoiceId },
                            data: {
                                properties: updatedProps
                            }
                        });
                        console.log(`[Stripe Webhook] Invoice ${invoiceId} marked as paid`);
                    } else {
                        console.warn(`[Stripe Webhook] Invoice page ${invoiceId} not found`);
                    }
                    break;
                }

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
                    const isTrial = sub.status === 'trialing';

                    await syncPlanToTenant(tenantId, planType, {
                        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
                        stripeSubscriptionId: sub.id,
                        stripePriceId: sub.items.data[0]?.price?.id,
                        subscriptionStatus: isTrial ? 'TRIAL' : 'ACTIVE',
                        billingCycle: session.metadata?.billingCycle || 'MONTHLY',
                    });

                    // Set trial end date from Stripe's trial_end timestamp
                    if (isTrial && sub.trial_end) {
                        const { default: prisma } = await import('@/lib/prisma');
                        await prisma.tenant.update({
                            where: { id: tenantId },
                            data: {
                                trialEndsAt: new Date(sub.trial_end * 1000),
                                trialNotifiedAt: null,
                            },
                        });
                    }
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

                // Determine dynamic price IDs for extra standard users and workforce members
                const extraUserPriceKey = planType === 'ENTERPRISE' ? 'EXTRA_USER_ENT' : 'EXTRA_USER_PRO';
                const workforcePriceKey = planType === 'ENTERPRISE' ? 'WORKFORCE_ENT' : 'WORKFORCE_PRO';
                
                const extraUserPriceId = getPriceId(extraUserPriceKey);
                const workforcePriceId = getPriceId(workforcePriceKey);

                const extraUserItem = sub.items.data.find(item => item.price.id === extraUserPriceId);
                const workforceItem = sub.items.data.find(item => item.price.id === workforcePriceId);

                const extraUserCount = extraUserItem?.quantity ?? 0;
                const workforceUserCount = workforceItem?.quantity ?? 0;

                await syncPlanToTenant(tenantId, planType, {
                    stripeSubscriptionId: sub.id,
                    stripePriceId: priceId,
                    subscriptionStatus: status,
                });

                // Update tenant counters in database
                const { default: prisma } = await import('@/lib/prisma');
                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: {
                        extraUserCount,
                        workforceUserCount,
                    },
                });

                console.log(`[Stripe Webhook] Updated subscription for tenant ${tenantId}: ${status} (seats: extraUsers=${extraUserCount}, workforce=${workforceUserCount})`);
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

                // Reset tenant counters in database
                const { default: prisma } = await import('@/lib/prisma');
                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: {
                        extraUserCount: 0,
                        workforceUserCount: 0,
                    },
                });

                console.log(`[Stripe Webhook] Subscription deleted — tenant ${tenantId} downgraded to FREE and seat counters reset to 0`);
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
