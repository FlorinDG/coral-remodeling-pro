import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import MobileShell from "@/components/mobile/MobileShell";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
    let activeModules: string[] = ["INVOICING"];
    let planType: string = "FREE";
    let lockedDbIds: Record<string, string> = {};
    let tenantId: string | null = null;

    try {
        const session = await auth();
        tenantId = session?.user?.tenantId ?? null;
    } catch (e) {
        console.error('[m/layout] auth() failed:', e);
    }

    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];

    if (tenantId) {
        try {
            const [tenant, fetchedDbs] = await Promise.all([
                prisma.tenant.findUnique({
                    where: { id: tenantId },
                    select: { activeModules: true, planType: true, lockedDbIds: true },
                }),
                getGlobalDatabases()
            ]);

            if (tenant?.activeModules) activeModules = tenant.activeModules;
            if (tenant?.planType) planType = tenant.planType;

            const persistedIds = tenant?.lockedDbIds as Record<string, string> | null;
            if (persistedIds && Object.keys(persistedIds).length > 0) {
                lockedDbIds = persistedIds;
            } else {
                lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
            }

            databases = fetchedDbs;
        } catch (e) {
            console.error('[m/layout] Parallel fetch failed:', e);
        }
    }

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <MobileShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds}>
                {children}
            </MobileShell>
        </AuthProvider>
    );
}
