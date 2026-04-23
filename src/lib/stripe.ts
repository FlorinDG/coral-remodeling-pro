/**
 * src/lib/stripe.ts
 * ─────────────────────────────────────────────────────────────────
 * Stripe billing integration — plan configuration, module mapping,
 * and tenant provisioning helpers.
 *
 * The Stripe SDK is initialised lazily; stripe-dependent helpers
 * will throw if STRIPE_SECRET_KEY is not set.
 * ─────────────────────────────────────────────────────────────────
 */

import prisma from './prisma';

// ── Plan → Module canonical mapping ──────────────────────────────────

export const PLAN_MODULES: Record<string, string[]> = {
    FREE:       ['INVOICING'],
    PRO:        ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS'],
    ENTERPRISE: ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS', 'HR', 'WEBSITES', 'EMAIL'],
    FOUNDER:    ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS', 'HR', 'WEBSITES', 'EMAIL'],
    CUSTOM:     ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS', 'HR', 'WEBSITES', 'EMAIL'],
};

// ── Pricing constants ────────────────────────────────────────────────

export const PLAN_PRICING = {
    PRO: {
        baseMonthly:       29,
        includedUsers:     1,
        extraUserMonthly:  20,
        workforceMonthly:  4.99,
        trialMonths:       1,
        cancellationNoticeMonths: 1,
    },
    ENTERPRISE: {
        baseMonthly:       99,
        includedUsers:     2,
        extraUserMonthly:  79,
        workforceMonthly:  1.99,
        trialMonths:       2,
        cancellationNoticeMonths: 2,
    },
    ENTERPRISE_BATIPRIX: {
        baseMonthly:       199,
        includedUsers:     2,
        extraUserMonthly:  79,
        workforceMonthly:  1.99,
        trialMonths:       2,
        cancellationNoticeMonths: 2,
    },
} as const;

export const QUARTERLY_DISCOUNT = 0.05;       // 5% flat
export const QUARTERLY_FIDELITY_DISCOUNT = 0.10; // 10% after first year

/** Peppol overage price per document (cost × ~10). */
export const PEPPOL_OVERAGE_PRICE = 0.99;

// ── OCR Scan quotas per plan ─────────────────────────────────────────

export const PLAN_SCAN_QUOTAS: Record<string, number> = {
    FREE:       30,
    PRO:        300,
    ENTERPRISE: -1,  // unlimited
    FOUNDER:    -1,
    CUSTOM:     -1,
};

// ── Stripe SDK (lazy init) ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _stripe: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getStripeInstance(): any {
    if (_stripe) return _stripe;

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not configured. Set it in your environment.');
    }

    // Stripe SDK is loaded dynamically to avoid bundling on the client side
    // and to prevent build errors when the 'stripe' package is not yet installed.
    // Install it with: npm install stripe
    try {
        const Stripe = eval("require")('stripe');
        _stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
        return _stripe;
    } catch {
        throw new Error(
            'Stripe SDK not installed. Run: npm install stripe'
        );
    }
}

// ── Stripe Price IDs (test + prod) ───────────────────────────────────
// Populated once Stripe products are created.

export const STRIPE_PRICE_IDS: Record<string, { test: string; prod: string }> = {
    PRO_MONTHLY:        { test: '', prod: '' },
    PRO_QUARTERLY:      { test: '', prod: '' },
    ENT_MONTHLY:        { test: '', prod: '' },
    ENT_QUARTERLY:      { test: '', prod: '' },
    EXTRA_USER_PRO:     { test: '', prod: '' },
    EXTRA_USER_ENT:     { test: '', prod: '' },
    WORKFORCE_PRO:      { test: '', prod: '' },
    WORKFORCE_ENT:      { test: '', prod: '' },
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Atomically sync a plan change to the tenant record.
 * Updates planType, activeModules, subscriptionStatus, scanQuota, and Stripe IDs.
 */
export async function syncPlanToTenant(
    tenantId: string,
    planType: string,
    opts?: {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        stripePriceId?: string;
        subscriptionStatus?: string;
        billingCycle?: string;
    }
) {
    const modules = PLAN_MODULES[planType] || PLAN_MODULES.FREE;
    const scanQuota = PLAN_SCAN_QUOTAS[planType] ?? PLAN_SCAN_QUOTAS.FREE;

    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            planType,
            activeModules: modules,
            scanQuota,
            ...(opts?.stripeCustomerId     && { stripeCustomerId:     opts.stripeCustomerId }),
            ...(opts?.stripeSubscriptionId && { stripeSubscriptionId: opts.stripeSubscriptionId }),
            ...(opts?.stripePriceId        && { stripePriceId:        opts.stripePriceId }),
            ...(opts?.subscriptionStatus   && { subscriptionStatus:   opts.subscriptionStatus }),
            ...(opts?.billingCycle         && { billingCycle:          opts.billingCycle }),
        },
    });
}

/**
 * Get or create a Stripe customer for a tenant.
 * Returns the Stripe customer ID.
 */
export async function getOrCreateStripeCustomer(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true, companyName: true, email: true, vatNumber: true },
    });

    if (!tenant) throw new Error('Tenant not found');
    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

    const stripe = getStripeInstance();
    const customer = await stripe.customers.create({
        name: tenant.companyName,
        email: tenant.email || undefined,
        metadata: { tenantId, vatNumber: tenant.vatNumber || '' },
    });

    await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customer.id },
    });

    return customer.id;
}

/**
 * Calculate the quarterly discount rate based on billing tenure.
 */
export function getQuarterlyDiscount(billingStartedAt: Date | null): number {
    if (!billingStartedAt) return QUARTERLY_DISCOUNT;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return billingStartedAt <= oneYearAgo ? QUARTERLY_FIDELITY_DISCOUNT : QUARTERLY_DISCOUNT;
}
