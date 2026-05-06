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
import { Resend } from 'resend';
import React from 'react';
import TrialNotificationEmail from '@/emails/TrialNotificationEmail';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

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
            trialGraceEndsAt: true,
            trialNotifiedAt: true,
            stripeSubscriptionId: true,
            companyName: true,
            email: true,
        },
    });

    for (const tenant of trialTenants) {
        const trialEnd = new Date(tenant.trialEndsAt!);

        // ── Expired: enter grace period or block ──
        if (now >= trialEnd) {
            // Only handle if they haven't added a payment method
            if (!tenant.stripeSubscriptionId) {
                const graceEnd = tenant.trialGraceEndsAt ? new Date(tenant.trialGraceEndsAt) : null;

                if (!graceEnd) {
                    // Start grace period
                    const newGraceEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
                    await prisma.tenant.update({
                        where: { id: tenant.id },
                        data: {
                            subscriptionStatus: 'PAST_DUE',
                            trialGraceEndsAt: newGraceEnd,
                        },
                    });
                    
                    // Send trial-expired (grace start) email
                    if (tenant.email) {
                        await resend.emails.send({
                            from: 'CoralOS <billing@coral-group.be>',
                            to: [tenant.email],
                            subject: `Trial Expired: ${tenant.companyName} — Grace Period Started`,
                            react: React.createElement(TrialNotificationEmail, {
                                type: 'EXPIRED',
                                companyName: tenant.companyName,
                                upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/settings/billing`,
                            }),
                        }).catch(err => console.error(`[Trial Email] Failed to send expired mail to ${tenant.id}:`, err));
                    }
                    console.log(`[Trial] Grace started: ${tenant.companyName} (${tenant.id}) — 14 days to pay`);
                    expired++;
                } else if (now >= graceEnd) {
                    // Grace period over -> BLOCK access
                    await prisma.tenant.update({
                        where: { id: tenant.id },
                        data: { subscriptionStatus: 'INACTIVE' },
                    });
                    console.log(`[Trial] Blocked: ${tenant.companyName} (${tenant.id}) — grace period over`);
                }
            } else {
                // They have a Stripe subscription — convert trial to active
                await prisma.tenant.update({
                    where: { id: tenant.id },
                    data: { subscriptionStatus: 'ACTIVE', trialEndsAt: null, trialGraceEndsAt: null },
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

            // Send trial-ending-soon email
            if (tenant.email) {
                await resend.emails.send({
                    from: 'CoralOS <billing@coral-group.be>',
                    to: [tenant.email],
                    subject: `Trial Ending Soon: ${tenant.companyName}`,
                    react: React.createElement(TrialNotificationEmail, {
                        type: 'ENDING',
                        companyName: tenant.companyName,
                        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/settings/billing`,
                        daysRemaining: daysLeft,
                    }),
                }).catch(err => console.error(`[Trial Email] Failed to send reminder mail to ${tenant.id}:`, err));
            }
            console.log(`[Trial] Reminder: ${tenant.companyName} (${tenant.id}) — ${daysLeft} days left`);
        }
    }

    return { expired, reminded };
}
