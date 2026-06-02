import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PLAN_LIMITS, PEPPOL_OVERAGE_PRICE_PER_DOC } from "@/lib/plan-limits";
import { QUARTERLY_DISCOUNT, QUARTERLY_FIDELITY_DISCOUNT } from "@/lib/stripe";
import MobileSettingsClient from "./MobileSettingsClient";

export default async function MobileSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await auth();
    const tenantId = session?.user?.tenantId;
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

            // Profile info
            companyName: true,
            vatNumber: true,
            email: true,
            street: true,
            postalCode: true,
            city: true,
            iban: true,
            bic: true,
            commercialName: true,
            deliveryStreet: true,
            deliveryPostalCode: true,
            deliveryCity: true,
            headquartersStreet: true,
            headquartersPostalCode: true,
            headquartersCity: true,
            directorFirstName: true,
            directorLastName: true,
            documentLanguage: true,
            
            // Branding/UI
            brandColor: true,
            
            // Document numbering
            invoicePrefix: true,
            invoiceConnector: true,
            invoiceDateFormat: true,
            invoiceNumberWidth: true,
            invoiceNextNumber: true,
            quotationPrefix: true,
            quotationConnector: true,
            quotationDateFormat: true,
            quotationNumberWidth: true,
            quotationNextNumber: true,
            documentTemplate: true,
        },
    });

    if (!tenant) redirect("/");

    const now = new Date();
    const trialDaysLeft = tenant.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    const peppolLimits = PLAN_LIMITS[tenant.planType as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.FREE;
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
        peppolSent: tenant.peppolSentThisMonth,
        peppolReceived: tenant.peppolReceivedThisMonth,
        peppolSentLimit: peppolLimits.peppolSent,
        peppolReceivedLimit: peppolLimits.peppolReceived,
        scanCount: tenant.scanCount,
        scanQuota: tenant.scanQuota,
        userCount: tenant._count.users,
        extraUserCount: tenant.extraUserCount,
        workforceUserCount: tenant.workforceUserCount,
        quarterlyDiscount,
        overagePrice: PEPPOL_OVERAGE_PRICE_PER_DOC,
    };

    const profileData = {
        companyName: tenant.companyName || '',
        vatNumber: tenant.vatNumber || '',
        email: tenant.email || '',
        street: tenant.street || '',
        postalCode: tenant.postalCode || '',
        city: tenant.city || '',
        iban: tenant.iban || '',
        bic: tenant.bic || '',
        commercialName: tenant.commercialName || '',
        deliveryStreet: tenant.deliveryStreet || '',
        deliveryPostalCode: tenant.deliveryPostalCode || '',
        deliveryCity: tenant.deliveryCity || '',
        headquartersStreet: tenant.headquartersStreet || '',
        headquartersPostalCode: tenant.headquartersPostalCode || '',
        headquartersCity: tenant.headquartersCity || '',
        directorFirstName: tenant.directorFirstName || '',
        directorLastName: tenant.directorLastName || '',
        documentLanguage: tenant.documentLanguage || '',
        invoicePrefix: tenant.invoicePrefix ?? 'INV',
        invoiceConnector: tenant.invoiceConnector ?? '-',
        invoiceDateFormat: tenant.invoiceDateFormat ?? 'YYYY',
        invoiceNumberWidth: tenant.invoiceNumberWidth ?? 3,
        invoiceNextNumber: tenant.invoiceNextNumber ?? 1,
        quotationPrefix: tenant.quotationPrefix ?? 'OFF',
        quotationConnector: tenant.quotationConnector ?? '-',
        quotationDateFormat: tenant.quotationDateFormat ?? 'YYYY',
        quotationNumberWidth: tenant.quotationNumberWidth ?? 3,
        quotationNextNumber: tenant.quotationNextNumber ?? 1,
        documentTemplate: tenant.documentTemplate ?? 't1',
        brandColor: tenant.brandColor ?? '#d35400',
    };

    return (
        <MobileSettingsClient
            locale={locale}
            activeModules={tenant.activeModules}
            planType={tenant.planType}
            billingData={billingData}
            initialProfile={profileData}
        />
    );
}
