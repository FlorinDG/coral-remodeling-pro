import { Suspense } from "react";
import AuthProvider from "@/components/AuthProvider";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import MobileShell from "@/components/mobile/MobileShell";
import { MobileScopeProvider } from "@/components/mobile/MobileScopeContext";
import DatabaseBootstrap from "@/components/admin/database/DatabaseBootstrap";
import StoreSession from "@/components/admin/database/StoreSession";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
    const t0 = performance.now();
    let activeModules: string[]             = ['INVOICING'];
    let planType: string                    = 'FREE';
    let lockedDbIds: Record<string, string> = {};
    let fullTenant: any                     = null;
    let tenantId: string | null             = null;
    let userId: string | null               = null;

    try {
        const session = await auth();
        tenantId = session?.user?.tenantId ?? null;
        userId = session?.user?.id ?? null;
        if (session?.user) {
            if ((session.user as any).activeModules) activeModules = (session.user as any).activeModules;
            if ((session.user as any).planType)      planType      = (session.user as any).planType;
        }
    } catch (e) {
        console.error('[m/layout] auth() failed:', e);
    }

    if (tenantId) {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    id: true,
                    companyName: true,
                    commercialName: true,
                    vatNumber: true,
                    iban: true,
                    bic: true,
                    email: true,
                    street: true,
                    postalCode: true,
                    city: true,
                    logoUrl: true,
                    brandColor: true,
                    documentTemplate: true,
                    documentMode: true,
                    stationeryUrl: true,
                    documentFont: true,
                    documentFontSize: true,
                    planType: true,
                    activeModules: true,
                    subscriptionStatus: true,
                    trialEndsAt: true,
                    lockedDbIds: true,
                    documentLanguage: true,
                    peppolId: true,
                    peppolRegistered: true,
                    peppolOptOut: true,
                    createdAt: true,
                    updatedAt: true,
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
                    creditnotePrefix: true,
                    creditnoteConnector: true,
                    creditnoteDateFormat: true,
                    creditnoteNumberWidth: true,
                    creditnoteNextNumber: true,
                },
            });

            if (tenant) {
                if (tenant.activeModules) activeModules = tenant.activeModules;
                if (tenant.planType)      planType      = tenant.planType;

                // MOBILE-PERF-1: the shell takes the tenant's stored bindings; provisioning + the schema reconcile run in
                // DatabaseBootstrap, streamed behind the shell (they repair a binding only in the rare unhealthy case).
                lockedDbIds = (tenant.lockedDbIds as Record<string, string> | null) || {};

                fullTenant = JSON.parse(JSON.stringify(tenant));
            }
        } catch (e) {
            console.error(`[m/layout] Tenant read failed:`, e);
        }

    }

    console.info(`[m/layout] shell ready in ${Math.round(performance.now() - t0)}ms (tenant=${tenantId})`);

    return (
        <AuthProvider>
            {/* MOBILE-PERF-1: the shell renders at once; the data streams in behind it (was: a white screen until all loaded) */}
            {/* CACHE-OWNER-1: the store knows who is signed in before any screen reads it */}
            {tenantId && <StoreSession tenantId={tenantId} userId={userId} />}
            {tenantId && (
                <Suspense fallback={null}>
                    <DatabaseBootstrap tenantId={tenantId} userId={userId} prepare={{ planType, activeModules }} label="m" />
                </Suspense>
            )}
            <MobileScopeProvider>
                <MobileShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={fullTenant}>
                    {children}
                </MobileShell>
            </MobileScopeProvider>
        </AuthProvider>
    );
}
