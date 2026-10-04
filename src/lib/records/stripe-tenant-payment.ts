/**
 * PAY-2 · when may a Stripe checkout confirmed by a TENANT's own Stripe account record a payment —
 * pure, tested (tests/stripe-tenant-payment.test.ts).
 *
 * A tenant's Stripe account cannot sign our platform webhook, so its checkout is confirmed by fetching the
 * session back with THAT tenant's key. Such a confirmation proves one thing: this tenant was paid this
 * amount for this session. It may therefore only ever record a payment on THIS tenant's invoice — never
 * provision a plan, never touch another tenant (Florin 2026-10-04: "no leak can occur at the level where
 * we cash in"). Everything is read from the session Stripe returned, never from the unsigned request body.
 */
export interface FetchedCheckoutSession {
    id?: string;
    payment_status?: string | null;
    mode?: string | null;
    currency?: string | null;
    amount_total?: number | null;
    metadata?: Record<string, string> | null;
}

export type TenantPaymentRefusal = 'not_paid' | 'not_a_payment' | 'tenant_mismatch' | 'no_invoice' | 'currency' | 'amount';

export function stripeTenantPaymentRefusal(s: FetchedCheckoutSession, keyOwnerTenantId: string): TenantPaymentRefusal | null {
    if (s.payment_status !== 'paid') return 'not_paid';
    if (s.mode && s.mode !== 'payment') return 'not_a_payment';                    // subscriptions are platform-only
    if (!s.metadata || s.metadata.tenantId !== keyOwnerTenantId) return 'tenant_mismatch';
    if (!s.metadata.invoiceId) return 'no_invoice';
    if ((s.currency || '').toLowerCase() !== 'eur') return 'currency';
    if (typeof s.amount_total !== 'number' || !Number.isFinite(s.amount_total) || s.amount_total <= 0) return 'amount';
    return null;
}

/** Stripe amounts are in cents. */
export function stripeAmountEuro(amountTotal: number): number {
    return Math.round(amountTotal) / 100;
}
