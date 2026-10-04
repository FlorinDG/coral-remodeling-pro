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
import { platformDb } from '@/lib/data/scope';
import { basePlanOf, licenseStatusOf, licenseEventRefusal } from '@/lib/records/license-subscription';

function stripeEnv(): 'test' | 'prod' {
    return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'prod';
}

/** The tenant a license event concerns: the owner of the Stripe CUSTOMER first; metadata only for a first purchase. */
async function licenseTenant(customerId: string | null, metadataTenantId: string | null) {
    const select = { id: true, stripeCustomerId: true, stripeSubscriptionId: true } as const;
    if (customerId) {
        const owner = await platformDb().tenant.findUnique({ where: { stripeCustomerId: customerId }, select });
        if (owner) return owner;
    }
    return metadataTenantId ? platformDb().tenant.findUnique({ where: { id: metadataTenantId }, select }) : null;
}

/** Seat add-ons on the subscription (extra users, workforce) for the plan it carries. */
function seatCounts(sub: Stripe.Subscription, plan: 'PRO' | 'ENTERPRISE') {
    const xu = getPriceId(plan === 'ENTERPRISE' ? 'EXTRA_USER_ENT' : 'EXTRA_USER_PRO');
    const wf = getPriceId(plan === 'ENTERPRISE' ? 'WORKFORCE_ENT' : 'WORKFORCE_PRO');
    return {
        extraUserCount: sub.items.data.find(it => it.price.id === xu)?.quantity ?? 0,
        workforceUserCount: sub.items.data.find(it => it.price.id === wf)?.quantity ?? 0,
    };
}
/**
 * Stripe is ONLY the CoralOS license fee (Florin 2026-10-04: "we do not handle payments for the tenants").
 * Every event must carry the PLATFORM's signature — there is no other sender, no fallback. A tenant's
 * invoices are paid by bank transfer and reconciled in its payments-in database (PAY-1), never here.
 */
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
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    console.log(`[Stripe Webhook] Received: ${event.type}`);

    try {
        switch (event.type) {
            // ── Checkout completed — provision subscription ──────────
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.metadata?.invoiceId) {
                    // Tenants' invoices are never paid through Stripe; a session naming one is not a license sale.
                    console.warn(`[Stripe Webhook] checkout ${session.id} names an invoice — not a license payment, ignored`);
                    break;
                }
                const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
                if (!subscriptionId) break;
                const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
                const tenant = await licenseTenant(customerId, session.metadata?.tenantId ?? null);
                if (!tenant) { console.warn(`[Stripe Webhook] checkout ${session.id}: no tenant for customer ${customerId}`); break; }
                const refusal = licenseEventRefusal(tenant, { customerId, metadataTenantId: session.metadata?.tenantId ?? null, subscriptionId, kind: 'checkout' });
                if (refusal) { console.error(`[Stripe Webhook] checkout ${session.id} refused for tenant ${tenant.id}: ${refusal}`); break; }

                const sub = await stripe.subscriptions.retrieve(subscriptionId);   // the current truth, not the payload
                const plan = basePlanOf(sub.items.data.map(it => it.price?.id), STRIPE_PRICE_IDS, stripeEnv());
                if (!plan) { console.error(`[Stripe Webhook] checkout ${session.id}: no known plan price on ${sub.id} — tenant ${tenant.id} NOT changed`); break; }
                const status = licenseStatusOf(sub.status) ?? 'ACTIVE';
                await syncPlanToTenant(tenant.id, plan, {
                    stripeCustomerId: customerId ?? undefined,
                    stripeSubscriptionId: sub.id,
                    stripePriceId: sub.items.data.find(it => basePlanOf([it.price?.id], STRIPE_PRICE_IDS, stripeEnv()))?.price?.id,
                    subscriptionStatus: status,
                    billingCycle: session.metadata?.billingCycle || 'MONTHLY',
                });
                await platformDb().tenant.update({ where: { id: tenant.id }, data: seatCounts(sub, plan) });
                if (status === 'TRIAL' && sub.trial_end) {
                    await platformDb().tenant.update({ where: { id: tenant.id }, data: { trialEndsAt: new Date(sub.trial_end * 1000), trialNotifiedAt: null } });
                }
                console.log(`[Stripe Webhook] License ${plan} (${status}) for tenant ${tenant.id}`);
                break;
            }

            // ── Subscription updated / deleted — read the CURRENT subscription, act only on the tenant's own ──
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const evSub = event.data.object as Stripe.Subscription;
                const customerId = typeof evSub.customer === 'string' ? evSub.customer : evSub.customer?.id ?? null;
                const tenant = await licenseTenant(customerId, evSub.metadata?.tenantId ?? null);
                if (!tenant) { console.warn(`[Stripe Webhook] ${event.type} ${evSub.id}: no tenant for customer ${customerId}`); break; }
                const refusal = licenseEventRefusal(tenant, { customerId, metadataTenantId: evSub.metadata?.tenantId ?? null, subscriptionId: evSub.id, kind: 'subscription' });
                if (refusal) { console.warn(`[Stripe Webhook] ${event.type} ${evSub.id} ignored for tenant ${tenant.id}: ${refusal}`); break; }

                // Stripe does not guarantee event order: the fetched subscription is the truth, not this payload.
                const sub = await stripe.subscriptions.retrieve(evSub.id);
                const status = licenseStatusOf(sub.status);
                if (status === 'CANCELLED') {
                    await syncPlanToTenant(tenant.id, 'FREE', { subscriptionStatus: 'CANCELLED' });
                    await platformDb().tenant.update({ where: { id: tenant.id }, data: { extraUserCount: 0, workforceUserCount: 0 } });
                    console.log(`[Stripe Webhook] License cancelled — tenant ${tenant.id} on FREE, seats 0`);
                    break;
                }
                const plan = basePlanOf(sub.items.data.map(it => it.price?.id), STRIPE_PRICE_IDS, stripeEnv());
                if (!plan) { console.error(`[Stripe Webhook] ${sub.id}: no known plan price — tenant ${tenant.id} plan NOT changed`); break; }
                await syncPlanToTenant(tenant.id, plan, {
                    stripeSubscriptionId: sub.id,
                    stripePriceId: sub.items.data.find(it => basePlanOf([it.price?.id], STRIPE_PRICE_IDS, stripeEnv()))?.price?.id,
                    ...(status ? { subscriptionStatus: status } : {}),
                });
                await platformDb().tenant.update({ where: { id: tenant.id }, data: seatCounts(sub, plan) });
                console.log(`[Stripe Webhook] License ${plan} ${status ?? '(status unchanged)'} for tenant ${tenant.id}`);
                break;
            }

            // ── Payment failed — mark PAST_DUE ──────────────────────
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = typeof invoice.customer === 'string'
                    ? invoice.customer
                    : invoice.customer?.id;

                if (customerId) {
                    await platformDb().tenant.updateMany({
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
                    await platformDb().tenant.updateMany({
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
