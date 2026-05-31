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
        extraUserMonthly:  19,
        workforceMonthly:  4.99,
        trialMonths:       3,
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
    PRO_MONTHLY:        { test: 'price_1TPc2UKwNqxpkJt0ftjywtnj', prod: 'price_1TULlq3Yz8g0NWgpZcPU3ERY' },
    ENT_MONTHLY:        { test: 'price_1TPc32KwNqxpkJt0gRuyqI1Z', prod: 'price_1TVGmW3Yz8g0NWgpCKzgMOnv' },
    EXTRA_USER_PRO:     { test: 'price_1TPcEbKwNqxpkJt0Wyy5MV0w', prod: 'price_1TULoj3Yz8g0NWgpU6agNLuf' },
    EXTRA_USER_ENT:     { test: 'price_1TPcFEKwNqxpkJt02pA0kxo0', prod: 'price_1TULuD3Yz8g0NWgpQhW7zHYw' },
    WORKFORCE_PRO:      { test: 'price_1TPcFxKwNqxpkJt0831VPMvf', prod: 'price_1TULrI3Yz8g0NWgpXlTp96cK' },
    WORKFORCE_ENT:      { test: 'price_1TPcGSKwNqxpkJt0znFmkGy4', prod: 'price_1TULuk3Yz8g0NWgp7FUc6Oyz' },
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

/**
 * Synchronise user & workforce seat counts from the database to Stripe subscription items.
 * Updates the Stripe quantities to match, and saves extraUserCount / workforceUserCount to the Tenant.
 */
export async function syncSeatQuantities(tenantId: string) {
    // 1. Count users in DB
    const standardUserCount = await prisma.user.count({
        where: {
            tenantId,
            role: { notIn: ['ACCOUNTANT', 'TENANT_ENTERPRISE_WORKFORCE'] },
            employeeStatus: { not: 'INACTIVE' }
        }
    });

    const workforceUserCount = await prisma.user.count({
        where: {
            tenantId,
            role: 'TENANT_ENTERPRISE_WORKFORCE',
            employeeStatus: { not: 'INACTIVE' }
        }
    });

    // 2. Fetch tenant
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planType: true, stripeSubscriptionId: true }
    });

    if (!tenant) throw new Error('Tenant not found');

    const planType = tenant.planType;
    const includedUsers = (PLAN_PRICING as any)[planType]?.includedUsers ?? 0;
    const extraUserCount = Math.max(0, standardUserCount - includedUsers);

    // 3. Update DB counters first (fail-safe)
    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            extraUserCount,
            workforceUserCount
        }
    });

    console.log(`[Seat Sync] Tenant ${tenantId} counters updated: extraUserCount=${extraUserCount}, workforceUserCount=${workforceUserCount}`);

    // 4. Update Stripe if subscription exists
    if (tenant.stripeSubscriptionId && ['PRO', 'ENTERPRISE'].includes(planType)) {
        const stripe = getStripeInstance();
        
        // Fetch subscription and its items
        const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
        
        // Get expected Price IDs for extra users and workforce
        const extraUserPriceKey = planType === 'ENTERPRISE' ? 'EXTRA_USER_ENT' : 'EXTRA_USER_PRO';
        const workforcePriceKey = planType === 'ENTERPRISE' ? 'WORKFORCE_ENT' : 'WORKFORCE_PRO';
        
        const extraUserPriceId = getPriceId(extraUserPriceKey);
        const workforcePriceId = getPriceId(workforcePriceKey);

        // Find existing subscription items on Stripe
        const extraUserItem = subscription.items.data.find(item => item.price.id === extraUserPriceId);
        const workforceItem = subscription.items.data.find(item => item.price.id === workforcePriceId);

        const itemsToUpdate: any[] = [];

        // Extra standard users item sync
        if (extraUserCount > 0) {
            if (extraUserItem) {
                // If it already exists and quantity differs, update it
                if (extraUserItem.quantity !== extraUserCount) {
                    itemsToUpdate.push({
                        id: extraUserItem.id,
                        quantity: extraUserCount
                    });
                }
            } else {
                // Add new item
                itemsToUpdate.push({
                    price: extraUserPriceId,
                    quantity: extraUserCount
                });
            }
        } else if (extraUserItem) {
            // Delete existing item since count is 0
            itemsToUpdate.push({
                id: extraUserItem.id,
                deleted: true
            });
        }

        // Workforce users item sync
        if (workforceUserCount > 0) {
            if (workforceItem) {
                // If it already exists and quantity differs, update it
                if (workforceItem.quantity !== workforceUserCount) {
                    itemsToUpdate.push({
                        id: workforceItem.id,
                        quantity: workforceUserCount
                    });
                }
            } else {
                // Add new item
                itemsToUpdate.push({
                    price: workforcePriceId,
                    quantity: workforceUserCount
                });
            }
        } else if (workforceItem) {
            // Delete existing item since count is 0
            itemsToUpdate.push({
                id: workforceItem.id,
                deleted: true
            });
        }

        if (itemsToUpdate.length > 0) {
            console.log(`[Seat Sync] Syncing Stripe subscription ${tenant.stripeSubscriptionId} items:`, itemsToUpdate);
            await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
                items: itemsToUpdate,
                proration_behavior: 'create_prorations' // instantly invoice or credit mid-month
            });
        }
    }
}
