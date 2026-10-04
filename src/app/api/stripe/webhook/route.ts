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
import { platformDb, systemScope } from '@/lib/data/scope';
import { recordStripePayment } from '@/lib/data/invoice-payments';
import { stripeTenantPaymentRefusal, stripeAmountEuro } from '@/lib/records/stripe-tenant-payment';

/**
 * PAY-2 · a checkout on a TENANT's own Stripe account. The request body is unsigned, so it only says which
 * tenant's key to ask; everything else is read from the session Stripe returns to THAT key. A confirmed,
 * matching payment becomes a payments-in row on that tenant's invoice (through its system scope) and the
 * invoice's status follows from the payments (PAY-1). Nothing else can happen on this path.
 */
async function handleTenantCheckout(body: string): Promise<NextResponse> {
    try {
        const raw = JSON.parse(body);
        if (raw?.type !== 'checkout.session.completed') return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
        const claimedTenantId: string | undefined = raw?.data?.object?.metadata?.tenantId;
        const sessionId: string | undefined = raw?.data?.object?.id;
        if (!claimedTenantId || !sessionId) return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });

        const tenant = await platformDb().tenant.findUnique({ where: { id: claimedTenantId }, select: { id: true, paymentProvider: true, stripeSecretKey: true } });
        if (!tenant || tenant.paymentProvider !== 'stripe' || !tenant.stripeSecretKey) return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
        const { decrypt } = await import('@/lib/encryption');
        const key = decrypt(tenant.stripeSecretKey);
        if (!key) return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetched = await new Stripe(key, { apiVersion: '2022-11-15' as any }).checkout.sessions.retrieve(sessionId);
        const refusal = stripeTenantPaymentRefusal(fetched as never, tenant.id);
        if (refusal) {
            console.warn(`[Stripe Webhook] tenant ${tenant.id} checkout ${sessionId} refused: ${refusal}`);
            return NextResponse.json({ received: true, recorded: false, reason: refusal });
        }
        const db = systemScope(tenant.id, `stripe checkout ${sessionId}`);
        const result = await recordStripePayment(db, tenant.id, {
            invoiceId: fetched.metadata!.invoiceId,
            sessionId,
            amount: stripeAmountEuro(fetched.amount_total!),
        });
        console.log(`[Stripe Webhook] tenant ${tenant.id} checkout ${sessionId}: ${result}`);
        return NextResponse.json({ received: true, recorded: result !== 'not_found' && result !== 'unbound', result });
    } catch (err) {
        console.error('[Stripe Webhook] tenant checkout verification failed:', err);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }
}

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
    } catch {
        // Not signed by the PLATFORM. The only other legitimate sender is a tenant's own Stripe account
        // (its checkout for one of its invoices). That path can only ever record a payment — it never
        // reaches the platform handlers below (plans, seats, subscription status). PAY-2.
        return handleTenantCheckout(body);
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
                    // A tenant's invoice is paid through the TENANT's Stripe account (handleTenantCheckout), never
                    // the platform's. A platform-signed session naming an invoice is not ours to act on. PAY-2.
                    console.warn(`[Stripe Webhook] platform checkout ${session.id} names invoice ${invoiceId} — ignored`);
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
