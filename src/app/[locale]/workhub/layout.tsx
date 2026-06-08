import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import WorkHubShell from "@/components/workhub/WorkHubShell";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import { redirect } from "next/navigation";

/**
 * /workhub — Standalone HR & Workforce Webapp
 * 
 * Same codebase, same database, same auth — just a different shell.
 * No admin sidebar. Mobile-first bottom navigation.
 * Reuses all existing HR, Tasks, and File Manager components.
 */
export default async function WorkHubLayout({ children }: { children: React.ReactNode }) {
    // ── Auth — redirect to login if not authenticated ──
    const session = await auth();
    if (!session?.user?.tenantId) redirect("/login");

    const tenantId = session.user.tenantId;

    // ── Fetch tenant data + databases ──
    let activeModules: string[] = ["HR"];
    let planType: string = "FREE";
    let lockedDbIds: Record<string, string> = {};

    try {
        const [tenant, databases] = await Promise.all([
            prisma.tenant.findUnique({
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
            }),
            getGlobalDatabases()
        ]);

        let fullTenant = null;
        if (tenant) {
            if (tenant.activeModules) activeModules = tenant.activeModules;
            if (tenant.planType) planType = tenant.planType;
            fullTenant = JSON.parse(JSON.stringify(tenant));
        }

        const persistedIds = tenant?.lockedDbIds as Record<string, string> | null;
        if (persistedIds && Object.keys(persistedIds).length > 0) {
            lockedDbIds = persistedIds;
        } else {
            lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
        }

        return (
            <AuthProvider>
                <GlobalDatabaseSyncer databases={databases} />
                <WorkHubShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={fullTenant}>
                    {children}
                </WorkHubShell>
            </AuthProvider>
        );
    } catch (e) {
        console.error('[workhub layout] Fetch failed:', e);
        return (
            <AuthProvider>
                <WorkHubShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds}>
                    {children}
                </WorkHubShell>
            </AuthProvider>
        );
    }
}
