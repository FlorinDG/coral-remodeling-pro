import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import { cookies } from "next/headers";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";

// Coral Enterprises tenant — the platform owner workspace.
const OWNER_TENANT_ID = process.env.OWNER_TENANT_ID ?? 'cmneyas2b0000veqvkgl2luz1';

export default async function Layout({ children }: { children: React.ReactNode }) {
    // ── 1. Session ──────────────────────────────────────────────────────────
    let session: any = null;
    let userRole: string | undefined;
    let tenantId: string | null = null;
    let isOwner = false;
    let isSuperadmin = false;
    let isImpersonating = false;

    // Baseline defaults — overridden by JWT session if available
    let activeModules: string[]               = ['INVOICING'];
    let planType: string                      = 'FREE';
    let lockedDbIds: Record<string, string>   = {};
    let subscriptionStatus: string            = 'ACTIVE';
    let trialEndsAt: string | null            = null;
    let fullTenant: any                       = null;

    try {
        session    = await auth();
        userRole   = session?.user?.role;
        tenantId   = session?.user?.tenantId ?? null;
        isOwner    = tenantId === OWNER_TENANT_ID;
        isSuperadmin = !!(userRole && PLATFORM_ADMIN_ROLES.includes(userRole as any));

        // Pull JWT-cached values as baseline (better than hardcoded defaults)
        if ((session?.user as any)?.activeModules) activeModules = (session.user as any).activeModules;
        if ((session?.user as any)?.planType)      planType      = (session.user as any).planType;
    } catch (e) {
        console.error('[layout] auth() failed:', e);
    }

    // ── 2. Impersonation ────────────────────────────────────────────────────
    if (isSuperadmin) {
        try {
            const cookieStore = await cookies();
            const impersonatedTenant = cookieStore.get('x-impersonate-tenant')?.value;
            if (impersonatedTenant) {
                tenantId = impersonatedTenant;
                isImpersonating = true;
            }
        } catch (e) {
            console.error('[layout] cookies() failed:', e);
        }
    }

    // ── 3. Tenant DB read — INDEPENDENT of database fetch ───────────────────
    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];

    if (tenantId) {
        // 3a. Tenant profile — critical path
        try {
            // IMPORTANT: select ONLY needed fields. The tenant row contains
            // ~2.3 MB of base64 image data (logoUrl, stationeryUrl) which blows
            // up RSC serialization and silently breaks the layout props.
            // logoUrl and stationeryUrl are fetched client-side on-demand.
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                omit: { logoUrl: true, stationeryUrl: true },
            });

            if (tenant) {
                if (tenant.activeModules)      activeModules      = tenant.activeModules;
                if (tenant.planType)           planType           = tenant.planType;
                if (tenant.subscriptionStatus) subscriptionStatus = tenant.subscriptionStatus;
                if (tenant.trialEndsAt)        trialEndsAt        = tenant.trialEndsAt.toISOString();

                const persistedIds = tenant.lockedDbIds as Record<string, string> | null;
                if (persistedIds && Object.keys(persistedIds).length > 0) {
                    lockedDbIds = persistedIds;
                } else {
                    lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
                }

                fullTenant = tenant;
                console.log(`[layout] Tenant OK: planType=${planType}, modules=${activeModules.length}, dbs=${Object.keys(lockedDbIds).length}`);
            } else {
                console.warn(`[layout] Tenant ${tenantId} not found`);
            }
        } catch (e) {
            console.error(`[layout] Tenant read FAILED for ${tenantId}:`, e);
        }

        // 3b. Global databases — non-critical
        try {
            databases = await getGlobalDatabases();
            console.log(`[layout] Databases: ${databases.length} loaded, ${databases.reduce((n, d) => n + d.pages.length, 0)} total pages`);
        } catch (e) {
            console.error('[layout] getGlobalDatabases() FAILED:', e);
        }
    } else {
        console.warn('[layout] No tenantId — skipping all DB reads');
    }

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout
                activeModules={activeModules}
                planType={planType}
                lockedDbIds={lockedDbIds}
                isOwner={isOwner}
                subscriptionStatus={subscriptionStatus}
                trialEndsAt={trialEndsAt}
                isImpersonating={isImpersonating}
                tenant={fullTenant}
            >
                {children}
            </AdminLayout>
        </AuthProvider>
    );
}
