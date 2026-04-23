/**
 * src/lib/trial.ts
 * ─────────────────────────────────────────────────────────────────
 * Trial management engine for CoralOS.
 *
 * - PRO trial: 1 month
 * - ENTERPRISE trial: 2 months
 * - 7-day reminder before expiry
 * - Auto-downgrade to FREE on expiry
 * ─────────────────────────────────────────────────────────────────
 */

import prisma from './prisma';
import { syncPlanToTenant, PLAN_PRICING } from './stripe';

// ── Trial Duration ──────────────────────────────────────────────────

const TRIAL_MONTHS: Record<string, number> = {
    PRO:        PLAN_PRICING.PRO.trialMonths,         // 1 month
    ENTERPRISE: PLAN_PRICING.ENTERPRISE.trialMonths,  // 2 months
};

// ── Start Trial ─────────────────────────────────────────────────────

/**
 * Activate a trial for the given plan.
 * Sets trialEndsAt based on plan type (1 month PRO, 2 months ENTERPRISE).
 */
export async function startTrial(tenantId: string, planType: 'PRO' | 'ENTERPRISE'): Promise<Date> {
    const months = TRIAL_MONTHS[planType] || 1;
    const trialEndsAt = new Date();
    trialEndsAt.setMonth(trialEndsAt.getMonth() + months);

    // Provision the plan with TRIAL status
    await syncPlanToTenant(tenantId, planType, { subscriptionStatus: 'TRIAL' });

    // Set the trial end date
    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            trialEndsAt,
            trialNotifiedAt: null, // reset notification flag
        },
    });

    return trialEndsAt;
}

// ── Trial Status Checks ─────────────────────────────────────────────

interface TenantTrialInfo {
    trialEndsAt: Date | null;
    subscriptionStatus: string;
    planType: string;
    stripeSubscriptionId: string | null;
}

/**
 * Check if a tenant is currently in an active trial.
 */
export function isTrialActive(tenant: TenantTrialInfo): boolean {
    if (tenant.subscriptionStatus !== 'TRIAL') return false;
    if (!tenant.trialEndsAt) return false;
    return new Date() < new Date(tenant.trialEndsAt);
}

/**
 * Get remaining trial days (0 if not in trial or expired).
 */
export function getTrialDaysRemaining(tenant: TenantTrialInfo): number {
    if (!isTrialActive(tenant)) return 0;
    const now = new Date();
    const end = new Date(tenant.trialEndsAt!);
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Check if the trial should show a warning (≤ 7 days left).
 */
export function isTrialWarning(tenant: TenantTrialInfo): boolean {
    if (!isTrialActive(tenant)) return false;
    return getTrialDaysRemaining(tenant) <= 7;
}

// ── Trial Expiry (Cron-compatible) ──────────────────────────────────

/**
 * Check all tenants for expired trials and auto-downgrade.
 * Also sends 7-day reminder (marks trialNotifiedAt).
 *
 * Call this from a daily Vercel Cron job.
 *
 * Returns { expired: number; reminded: number }
 */
export async function checkAndExpireTrials(): Promise<{ expired: number; reminded: number }> {
    const now = new Date();
    let expired = 0;
    let reminded = 0;

    // Find all tenants currently in trial
    const trialTenants = await prisma.tenant.findMany({
        where: { subscriptionStatus: 'TRIAL', trialEndsAt: { not: null } },
        select: {
            id: true,
            planType: true,
            trialEndsAt: true,
            trialNotifiedAt: true,
            stripeSubscriptionId: true,
            companyName: true,
            email: true,
        },
    });

    for (const tenant of trialTenants) {
        const trialEnd = new Date(tenant.trialEndsAt!);

        // ── Expired: downgrade to FREE ──
        if (now >= trialEnd) {
            // Only auto-downgrade if they haven't added a payment method (no Stripe subscription)
            if (!tenant.stripeSubscriptionId) {
                await syncPlanToTenant(tenant.id, 'FREE', { subscriptionStatus: 'ACTIVE' });
                await prisma.tenant.update({
                    where: { id: tenant.id },
                    data: { trialEndsAt: null },
                });
                expired++;

                // TODO: Send trial-expired email
                console.log(`[Trial] Expired: ${tenant.companyName} (${tenant.id}) — downgraded to FREE`);
            } else {
                // They have a Stripe subscription — convert trial to active
                await prisma.tenant.update({
                    where: { id: tenant.id },
                    data: { subscriptionStatus: 'ACTIVE', trialEndsAt: null },
                });
                console.log(`[Trial] Converted: ${tenant.companyName} (${tenant.id}) — trial → active (has subscription)`);
            }
            continue;
        }

        // ── 7-day warning ──
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7 && !tenant.trialNotifiedAt) {
            await prisma.tenant.update({
                where: { id: tenant.id },
                data: { trialNotifiedAt: now },
            });
            reminded++;

            // TODO: Send trial-ending-soon email
            console.log(`[Trial] Reminder: ${tenant.companyName} (${tenant.id}) — ${daysLeft} days left`);
        }
    }

    return { expired, reminded };
}
