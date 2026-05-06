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

import Stripe from 'stripe';
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

// ── Peppol Limits per plan ───────────────────────────────────────────

export const PLAN_PEPPOL_LIMITS: Record<string, number> = {
    FREE:       50,   // documents/month included
    PRO:        250,
    ENTERPRISE: 1000,
    FOUNDER:    -1,
    CUSTOM:     -1,
};

// ── Stripe SDK (singleton) ──────────────────────────────────────────

let _stripe: Stripe | null = null;

export function getStripeInstance(): Stripe {
    if (_stripe) return _stripe;

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not configured. Set it in your environment.');
    }

    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
    return _stripe;
}

export const STRIPE_PRICE_IDS: Record<string, { test: string; prod: string }> = {
    PRO_MONTHLY:        { test: 'price_1TPc2UKwNqxpkJt0ftjywtnj', prod: '' },
    ENT_MONTHLY:        { test: 'price_1TPc32KwNqxpkJt0gRuyqI1Z', prod: '' },
    EXTRA_USER_PRO:     { test: 'price_1TPcEbKwNqxpkJt0Wyy5MV0w', prod: '' },
    EXTRA_USER_ENT:     { test: 'price_1TPcFEKwNqxpkJt02pA0kxo0', prod: '' },
    WORKFORCE_PRO:      { test: 'price_1TPcFxKwNqxpkJt0831VPMvf', prod: '' },
    WORKFORCE_ENT:      { test: 'price_1TPcGSKwNqxpkJt0znFmkGy4', prod: '' },
};

/** Get the correct price ID for the current environment. */
export function getPriceId(key: keyof typeof STRIPE_PRICE_IDS): string {
    const entry = STRIPE_PRICE_IDS[key];
    const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    const id = isTest ? entry.test : entry.prod;
    if (!id) throw new Error(`Missing ${isTest ? 'test' : 'prod'} price ID for ${key}`);
    return id;
}

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

/**
 * Calculate unsettled Peppol overage fees for a tenant.
 */
export async function calculatePeppolOverage(tenantId: string): Promise<number> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planType: true, peppolSentThisMonth: true, peppolReceivedThisMonth: true },
    });

    if (!tenant) return 0;

    const limit = PLAN_PEPPOL_LIMITS[tenant.planType] || PLAN_PEPPOL_LIMITS.FREE;
    if (limit === -1) return 0; // Unlimited

    const totalDocs = tenant.peppolSentThisMonth + tenant.peppolReceivedThisMonth;
    const overageDocs = Math.max(0, totalDocs - limit);
    
    return Number((overageDocs * PEPPOL_OVERAGE_PRICE).toFixed(2));
}
