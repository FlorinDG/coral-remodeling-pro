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
// Set OWNER_TENANT_ID in .env to override the production ID.
const OWNER_TENANT_ID = process.env.OWNER_TENANT_ID ?? 'cmneyas2b0000veqvkgl2luz1';

export default async function Layout({ children }: { children: React.ReactNode }) {
    // ── Safe defaults (most restrictive — matches new-tenant provisioning) ──
    // Every block below falls back to these. A failure in one block does NOT
    // cascade — the layout always renders and tenants always see a working UI.
    let activeModules: string[] = ["INVOICING"];
    let planType: string = "FREE";
    let lockedDbIds: Record<string, string> = {};
    let tenantId: string | null = null;
    let isOwner = false;
    let subscriptionStatus: string = 'ACTIVE';
    let trialEndsAt: string | null = null;
    let fullTenant: any = null;

    let isImpersonating = false;

    // ── 1. Session — safe fallback: treat as unauthenticated ────────────────
    try {
        const session = await auth();
        const userRole = session?.user?.role;
        tenantId = session?.user?.tenantId ?? null;
        isOwner  = tenantId === OWNER_TENANT_ID;

        // SuperAdmin impersonation: override tenantId with cookie value
        if (userRole && PLATFORM_ADMIN_ROLES.includes(userRole)) {
            const cookieStore = await cookies();
            const impersonatedTenant = cookieStore.get('x-impersonate-tenant')?.value;
            if (impersonatedTenant) {
                tenantId = impersonatedTenant;
                isImpersonating = true;
            }
        }
    } catch (e) {
        console.error('[layout] auth() failed:', e);
    }

    // ── 2 & 3. Fetch Tenant data and Global databases in parallel ────────────────
    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];
    
    if (tenantId) {
        try {
            const [tenant, fetchedDbs] = await Promise.all([
                prisma.tenant.findUnique({
                    where:  { id: tenantId },
                }),
                getGlobalDatabases()
            ]);

            if (tenant?.activeModules) activeModules = tenant.activeModules;
            if (tenant?.planType)      planType       = tenant.planType;
            if (tenant?.subscriptionStatus) subscriptionStatus = tenant.subscriptionStatus;
            if (tenant?.trialEndsAt) trialEndsAt = tenant.trialEndsAt.toISOString();

            const persistedIds = tenant?.lockedDbIds as Record<string, string> | null;
            if (persistedIds && Object.keys(persistedIds).length > 0) {
                lockedDbIds = persistedIds;
            } else {
                // First login — provision locked DBs
                lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
            }

            databases = fetchedDbs;
            // tenant is now the full object
            fullTenant = tenant;
        } catch (e) {
            console.error('[layout] Parallel fetch failed:', e);
            // safe defaults already set
        }
    }

    const displayActiveModules = isImpersonating
        ? ["INVOICING", "CRM", "DATABASES", "PROJECTS", "CALENDAR", "HR", "WEBSITES", "EMAIL"]
        : activeModules;
    const displayPlanType = isImpersonating ? "ENTERPRISE" : planType;

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout activeModules={displayActiveModules} planType={displayPlanType} lockedDbIds={lockedDbIds} isOwner={isOwner} subscriptionStatus={subscriptionStatus} trialEndsAt={trialEndsAt} isImpersonating={isImpersonating} tenant={fullTenant}>
                {children}
            </AdminLayout>
        </AuthProvider>
    );
}
