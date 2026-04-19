import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";

export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    // Defaults — most restrictive safe fallback (matches new-tenant provisioning)
    let activeModules: string[] = ["INVOICING"];
    let planType: string = "FREE";
    let lockedDbIds: Record<string, string> = {};

    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { activeModules: true, planType: true, lockedDbIds: true },
        });
        if (tenant?.activeModules) activeModules = tenant.activeModules;
        if (tenant?.planType)     planType       = tenant.planType;

        const persistedIds = tenant?.lockedDbIds as Record<string, string> | null;

        if (persistedIds && Object.keys(persistedIds).length > 0) {
            lockedDbIds = persistedIds;
        } else {
            // First login for this tenant — provision locked DBs now
            // (also handles the case where signup provisioning was skipped)
            try {
                lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
            } catch (e) {
                console.error('[layout] provisionLockedDatabases failed:', e);
                // Fall through with bare IDs — legacy FOUNDER tenant behavior
            }
        }
    }

    const databases = await getGlobalDatabases();

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds}>{children}</AdminLayout>
        </AuthProvider>
    );
}

