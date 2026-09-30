import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases, getGlobalDatabaseSchemas, getGlobalPageIndex } from "@/app/actions/global-databases";
import { IS_LAZY_DATA_ENABLED } from "@/lib/feature-flags";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import WorkHubShell from "@/components/workhub/WorkHubShell";
import { WorkHubProviders } from "@/components/workhub/WorkHubProviders";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import { redirect } from "next/navigation";
import { isWorkforceRole } from "@/lib/roles";

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

    // FILES-CREW-1 / WH-2: the crew's screens read the HR API, never the ERP database store.
    // Loading it shipped EVERY ERP database (invoices, expenses, clients, quotes — only projects
    // were filtered) to the crew phone and persisted it in the browser. Office roles using the
    // WorkHub keep it (the admin "Record Site Visit" needs it).
    const crew = isWorkforceRole((session.user as { role?: string }).role);

    // ── Fetch tenant data + databases ──
    let activeModules: string[] = ["HR"];
    let planType: string = "FREE";
    let lockedDbIds: Record<string, string> = {};

    try {
        const [tenant, databases, pageIndex] = await Promise.all([
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
            crew ? Promise.resolve([]) : (IS_LAZY_DATA_ENABLED ? getGlobalDatabaseSchemas() : getGlobalDatabases()),
            crew ? Promise.resolve([]) : getGlobalPageIndex()
        ]);

        let fullTenant = null;
        if (tenant) {
            if (tenant.activeModules) activeModules = tenant.activeModules;
            if (tenant.planType) planType = tenant.planType;
            // A crew phone gets what the crew app shows (name, logo, brand colour) — not the tenant's
            // IBAN, VAT, Peppol id or invoice numbering, which the full record carries.
            fullTenant = crew
                ? { id: tenant.id, companyName: tenant.companyName, commercialName: tenant.commercialName, logoUrl: tenant.logoUrl, brandColor: tenant.brandColor }
                : JSON.parse(JSON.stringify(tenant));
        }

        // The tenant's database ids are ERP plumbing. A crew phone never needs them (no crew screen
        // reads the ERP store), and holding them let a crafted request aim at an ERP database.
        if (!crew) {
            try {
                lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
            } catch (provErr) {
                console.error('[workhub layout] Provisioning failed:', provErr);
                lockedDbIds = (tenant?.lockedDbIds as Record<string, string> | null) || {};
            }
        }

        return (
            <AuthProvider>
                <WorkHubProviders>
                    {!crew && (
                        <GlobalDatabaseSyncer databases={databases} pageIndex={pageIndex} tenantId={tenantId} userId={session?.user?.id} />
                    )}
                    <WorkHubShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={fullTenant}>
                        {children}
                    </WorkHubShell>
                </WorkHubProviders>
            </AuthProvider>
        );
    } catch (e) {
        console.error('[workhub layout] Fetch failed:', e);
        return (
            <AuthProvider>
                <WorkHubProviders>
                    <WorkHubShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds}>
                        {children}
                    </WorkHubShell>
                </WorkHubProviders>
            </AuthProvider>
        );
    }
}
