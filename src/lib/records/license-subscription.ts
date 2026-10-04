/**
 * LIC-1 · the CoralOS license fee — how a Stripe subscription becomes a tenant's plan. Pure, tested
 * (tests/license-subscription.test.ts). Stripe is ONLY for this (Florin 2026-10-04).
 *
 * Found 2026-10-04 in the webhook:
 *   - an unknown price defaulted to PRO (an ENTERPRISE / FOUNDER tenant could be downgraded);
 *   - the plan was read from metadata before the price (stale after a plan change in the Stripe portal);
 *   - events of an OLD subscription changed the tenant (its "deleted" dropped an active tenant to FREE);
 *   - every subscription update reset the tenant's modules to the plan default (manual grants wiped at
 *     each renewal — "nothing recomputes behind Florin's grants", ENT-12);
 *   - the tenant came from event metadata only, never checked against the Stripe customer it owns.
 */

export type PriceTable = Record<string, { test: string; prod: string }>;
export type LicensePlan = 'PRO' | 'ENTERPRISE';

/** The BASE plan of a subscription — only the plan prices count, never seat add-ons; unknown → null. */
export function basePlanOf(priceIds: Array<string | null | undefined>, table: PriceTable, env: 'test' | 'prod'): LicensePlan | null {
    const proId = table.PRO_MONTHLY?.[env];
    const entId = table.ENT_MONTHLY?.[env];
    if (entId && priceIds.includes(entId)) return 'ENTERPRISE';
    if (proId && priceIds.includes(proId)) return 'PRO';
    return null;
}

/** Stripe subscription status → the tenant's subscriptionStatus; null = leave it as it is. */
export function licenseStatusOf(stripeStatus: string | null | undefined): 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED' | null {
    switch (stripeStatus) {
        case 'active': return 'ACTIVE';
        case 'trialing': return 'TRIAL';
        case 'past_due':
        case 'unpaid': return 'PAST_DUE';
        case 'canceled':
        case 'incomplete_expired': return 'CANCELLED';
        default: return null;            // incomplete, paused, unknown: no change
    }
}

export type LicenseRefusal = 'customer_mismatch' | 'tenant_mismatch' | 'other_subscription';

/**
 * May this subscription event change this tenant?
 * - the tenant's Stripe customer (when it has one) must be the event's customer;
 * - when the metadata names a tenant, it must be this one;
 * - a subscription event must concern the tenant's CURRENT subscription (when it has one).
 */
export function licenseEventRefusal(
    tenant: { id: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null },
    ev: { customerId: string | null; metadataTenantId: string | null; subscriptionId: string | null; kind: 'checkout' | 'subscription' },
): LicenseRefusal | null {
    if (tenant.stripeCustomerId && ev.customerId && tenant.stripeCustomerId !== ev.customerId) return 'customer_mismatch';
    if (ev.metadataTenantId && ev.metadataTenantId !== tenant.id) return 'tenant_mismatch';
    if (ev.kind === 'subscription' && tenant.stripeSubscriptionId && ev.subscriptionId && tenant.stripeSubscriptionId !== ev.subscriptionId) return 'other_subscription';
    return null;
}

/** The plan TEMPLATE (modules, quota) is applied only when the plan CHANGES — never on a renewal. */
export function planChanged(currentPlan: string | null | undefined, nextPlan: string): boolean {
    return (currentPlan || '').toUpperCase() !== nextPlan.toUpperCase();
}
