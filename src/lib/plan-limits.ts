/**
 * Plan limits & enforcement utilities for CoralOS.
 *
 * Limits (source of truth):
 *   FREE      — 5 Peppol sent / month, 10 Peppol received / month
 *   PRO       — 20 sent / month, 30 received / month
 *   FOUNDER   — unlimited (legacy perks)
 *   ENTERPRISE — unlimited
 *
 * Counter reset: 1st of each calendar month (UTC).
 *
 * Received invoices are NEVER blocked — bookkeeping is never interrupted.
 * Over-quota received documents are flagged via `peppolOverQuota` in response.
 */

import prisma from './prisma';

export const PLAN_LIMITS = {
    FREE:       { peppolSent: 5,    peppolReceived: 10  },
    PRO:        { peppolSent: 20,   peppolReceived: 30  },
    FOUNDER:    { peppolSent: null, peppolReceived: null }, // unlimited
    ENTERPRISE: { peppolSent: null, peppolReceived: null }, // unlimited
} as const;

/**
 * Peppol overage pricing — charged per document beyond the plan quota.
 * Pricing = approximate e-invoice.be cost × 10.
 * Made explicit to the tenant in the billing UI.
 */
export const PEPPOL_OVERAGE_PRICE_PER_DOC = 0.99; // €0.99

export type PlanType = keyof typeof PLAN_LIMITS;

// ── Internal helper ─────────────────────────────────────────────────────────

/** Fetch the tenant's current plan + counters, resetting if needed. */
async function getTenantPlan(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            planType: true,
            peppolSentThisMonth: true,
            peppolReceivedThisMonth: true,
            peppolCounterResetAt: true,
        },
    });
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
}

// ── Monthly counter reset ───────────────────────────────────────────────────

/**
 * Resets Peppol counters if we've crossed into a new calendar month (UTC).
 * Safe to call on every request — it's a no-op when no reset is needed.
 */
export async function maybeResetMonthlyCounters(tenantId: string): Promise<void> {
    const tenant = await getTenantPlan(tenantId);
    const resetAt = tenant.peppolCounterResetAt ?? new Date(0);

    const now = new Date();
    const resetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    if (resetAt < resetMonth) {
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                peppolSentThisMonth: 0,
                peppolReceivedThisMonth: 0,
                peppolCounterResetAt: resetMonth,
            },
        });
    }
}

// ── Hard guard — Peppol SEND ────────────────────────────────────────────────

/**
 * Throws a 429-style error if this tenant has exhausted their monthly Peppol send quota.
 * Call BEFORE dispatching the invoice to e-invoice.be.
 */
export async function assertPeppolSentLimit(tenantId: string): Promise<void> {
    const tenant = await getTenantPlan(tenantId);
    const plan = (tenant.planType as PlanType) in PLAN_LIMITS
        ? (tenant.planType as PlanType)
        : 'FREE';
    const limit = PLAN_LIMITS[plan].peppolSent;
    if (limit === null) return; // unlimited

    if ((tenant.peppolSentThisMonth ?? 0) >= limit) {
        throw Object.assign(
            new Error(`PEPPOL_SEND_LIMIT`),
            { code: 'PEPPOL_SEND_LIMIT', limit, plan, current: tenant.peppolSentThisMonth }
        );
    }
}

/** Increments the monthly sent counter by 1 after a successful dispatch. */
export function incrementPeppolSent(tenantId: string) {
    return prisma.tenant.update({
        where: { id: tenantId },
        data: { peppolSentThisMonth: { increment: 1 } },
    });
}

// ── Soft check — Peppol RECEIVE ─────────────────────────────────────────────

/**
 * Returns quota info for received invoices.
 * Never throws — received invoices are always stored.
 * The caller decides whether to surface a warning banner.
 */
export async function checkPeppolReceivedQuota(tenantId: string): Promise<{
    overQuota: boolean;
    current: number;
    limit: number | null;
    plan: PlanType;
}> {
    const tenant = await getTenantPlan(tenantId);
    const plan = (tenant.planType as PlanType) in PLAN_LIMITS
        ? (tenant.planType as PlanType)
        : 'FREE';
    const limit = PLAN_LIMITS[plan].peppolReceived;
    const current = tenant.peppolReceivedThisMonth ?? 0;

    return {
        overQuota: limit !== null && current >= limit,
        current,
        limit,
        plan,
    };
}

/** Increments the monthly received counter by 1. Always succeeds. */
export async function incrementPeppolReceived(tenantId: string): Promise<void> {
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { peppolReceivedThisMonth: { increment: 1 } },
    });
}

// ── Usage summary (for UI widget) ───────────────────────────────────────────

export async function getPeppolUsage(tenantId: string): Promise<{
    plan: PlanType;
    sent: number;
    sentLimit: number | null;
    received: number;
    receivedLimit: number | null;
    sentOverQuota: boolean;
    receivedOverQuota: boolean;
}> {
    await maybeResetMonthlyCounters(tenantId);
    const tenant = await getTenantPlan(tenantId);
    const plan = (tenant.planType as PlanType) in PLAN_LIMITS
        ? (tenant.planType as PlanType)
        : 'FREE';
    const limits = PLAN_LIMITS[plan];
    const sent     = tenant.peppolSentThisMonth ?? 0;
    const received = tenant.peppolReceivedThisMonth ?? 0;

    return {
        plan,
        sent,
        sentLimit:         limits.peppolSent,
        received,
        receivedLimit:     limits.peppolReceived,
        sentOverQuota:     limits.peppolSent     !== null && sent     >= limits.peppolSent,
        receivedOverQuota: limits.peppolReceived !== null && received >= limits.peppolReceived,
    };
}
