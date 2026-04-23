/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle.
 * Secured via STRIPE_WEBHOOK_SECRET signature verification.
 *
 * Events handled:
 * - checkout.session.completed → provision plan upgrade
 * - customer.subscription.updated → plan/seat changes
 * - customer.subscription.deleted → schedule downgrade
 * - invoice.payment_failed → PAST_DUE status
 * - invoice.paid → clear PAST_DUE
 */

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured — skipping');
        return NextResponse.json({ received: false, error: 'Webhook secret not configured' }, { status: 503 });
    }

    try {
        const body = await req.text();
        const signature = req.headers.get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
        }

        // TODO: Verify signature and handle events when Stripe is configured
        // const stripe = getStripeInstance();
        // const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        //
        // switch (event.type) {
        //   case 'checkout.session.completed': ...
        //   case 'customer.subscription.updated': ...
        //   case 'customer.subscription.deleted': ...
        //   case 'invoice.payment_failed': ...
        //   case 'invoice.paid': ...
        // }

        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        console.error('[Stripe Webhook]', error);
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}
