import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases, getGlobalDatabaseSchemas, getGlobalPageIndex } from "@/app/actions/global-databases";
import { IS_LAZY_DATA_ENABLED } from "@/lib/feature-flags";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import MobileShell from "@/components/mobile/MobileShell";
import { MobileScopeProvider } from "@/components/mobile/MobileScopeContext";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
    let activeModules: string[]             = ['INVOICING'];
    let planType: string                    = 'FREE';
    let lockedDbIds: Record<string, string> = {};
    let fullTenant: any                     = null;
    let tenantId: string | null             = null;
    let userId: string | null               = null;
    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];
    let pageIndex: Awaited<ReturnType<typeof getGlobalPageIndex>> = [];

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

                const persistedIds = tenant.lockedDbIds as Record<string, string> | null;
                if (persistedIds && Object.keys(persistedIds).length > 0) {
                    lockedDbIds = persistedIds;
                } else {
                    lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
                }

                fullTenant = JSON.parse(JSON.stringify(tenant));
            }
        } catch (e) {
            console.error(`[m/layout] Tenant read failed:`, e);
        }

        try {
            databases = IS_LAZY_DATA_ENABLED ? await getGlobalDatabaseSchemas() : await getGlobalDatabases();
        } catch (e) {
            console.error('[m/layout] database fetch failed:', e);
        }

        try {
            pageIndex = await getGlobalPageIndex();
        } catch (e) {
            console.error('[m/layout] getGlobalPageIndex() failed:', e);
        }
    }

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} pageIndex={pageIndex} tenantId={tenantId} userId={userId} />
            <MobileScopeProvider>
                <MobileShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={fullTenant}>
                    {children}
                </MobileShell>
            </MobileScopeProvider>
        </AuthProvider>
    );
}
