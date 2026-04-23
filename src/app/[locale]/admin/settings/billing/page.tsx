import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PLAN_MODULES, PLAN_PRICING, QUARTERLY_DISCOUNT, QUARTERLY_FIDELITY_DISCOUNT, PEPPOL_OVERAGE_PRICE, PLAN_SCAN_QUOTAS } from "@/lib/stripe";
import { PLAN_LIMITS, PEPPOL_OVERAGE_PRICE_PER_DOC } from "@/lib/plan-limits";
import { PLAN_USER_LIMITS } from "@/lib/roles";
import BillingPageClient from "./BillingPageClient";

export default async function BillingPage() {
    const session = await auth();
    const tenantId = (session?.user as { tenantId?: string })?.tenantId;
    if (!tenantId) redirect("/");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            planType: true,
            subscriptionStatus: true,
            activeModules: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            trialEndsAt: true,
            billingCycle: true,
            billingStartedAt: true,
            extraUserCount: true,
            workforceUserCount: true,
            peppolSentThisMonth: true,
            peppolReceivedThisMonth: true,
            scanCount: true,
            scanQuota: true,
            cancellationRequestedAt: true,
            cancellationEffectiveAt: true,
            _count: { select: { users: true } },
        },
    });

    if (!tenant) redirect("/");

    // Calculate trial info (server component — Date.now() is stable per-request)
    const now = new Date();
    const trialDaysLeft = tenant.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    // Peppol limits for current plan
    const peppolLimits = PLAN_LIMITS[tenant.planType as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.FREE;

    // Fidelity discount check
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const isFirstYear = !tenant.billingStartedAt || new Date(tenant.billingStartedAt) > oneYearAgo;
    const quarterlyDiscount = isFirstYear ? QUARTERLY_DISCOUNT : QUARTERLY_FIDELITY_DISCOUNT;

    const billingData = {
        planType: tenant.planType,
        subscriptionStatus: tenant.subscriptionStatus,
        billingCycle: tenant.billingCycle || 'MONTHLY',
        hasStripe: !!tenant.stripeCustomerId,
        hasSubscription: !!tenant.stripeSubscriptionId,
        trialDaysLeft,
        isTrialing: tenant.subscriptionStatus === 'TRIAL',
        isCancelling: !!tenant.cancellationRequestedAt,
        cancellationEffectiveAt: tenant.cancellationEffectiveAt?.toISOString() || null,

        // Usage
        peppolSent: tenant.peppolSentThisMonth,
        peppolReceived: tenant.peppolReceivedThisMonth,
        peppolSentLimit: peppolLimits.peppolSent,
        peppolReceivedLimit: peppolLimits.peppolReceived,
        scanCount: tenant.scanCount,
        scanQuota: tenant.scanQuota,
        userCount: tenant._count.users,
        extraUserCount: tenant.extraUserCount,
        workforceUserCount: tenant.workforceUserCount,

        // Pricing context
        quarterlyDiscount,
        overagePrice: PEPPOL_OVERAGE_PRICE_PER_DOC,
    };

    return <BillingPageClient data={billingData} />;
}
