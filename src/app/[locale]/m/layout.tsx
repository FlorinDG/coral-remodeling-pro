import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import MobileShell from "@/components/mobile/MobileShell";

// Force every request to re-render — reads auth + cookies.
export const dynamic = 'force-dynamic';

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
    // ── 1. Session baseline ─────────────────────────────────────────────────
    // JWT already carries planType + activeModules (refreshed every 60 s).
    // Use those as the baseline — never a hardcoded 'FREE'.
    const session   = await auth();
    const tenantId  = session?.user?.tenantId ?? null;

    let activeModules: string[]             = (session?.user as any)?.activeModules ?? ['INVOICING'];
    let planType: string                    = (session?.user as any)?.planType      ?? 'FREE';
    let lockedDbIds: Record<string, string> = {};
    let fullTenant: any                     = null;
    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];

    if (tenantId) {
        // ── 2a. Tenant profile — critical path ──────────────────────────────
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
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

                fullTenant = tenant;
            } else {
                console.warn(`[m/layout] Tenant ${tenantId} not found — using session values`);
            }
        } catch (e) {
            console.error(`[m/layout] Tenant read failed — using session values (planType=${planType}):`, e);
        }

        // ── 2b. Global databases — non-critical ─────────────────────────────
        try {
            databases = await getGlobalDatabases();
        } catch (e) {
            console.error('[m/layout] getGlobalDatabases() failed:', e);
        }
    }

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <MobileShell activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={fullTenant}>
                {children}
            </MobileShell>
        </AuthProvider>
    );
}
