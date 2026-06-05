import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import { cookies } from "next/headers";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";

// Force every request to re-render. The layout reads auth + cookies so
// it must never be served from RSC cache (would return stale planType).
export const dynamic = 'force-dynamic';

// Coral Enterprises tenant — the platform owner workspace.
const OWNER_TENANT_ID = process.env.OWNER_TENANT_ID ?? 'cmneyas2b0000veqvkgl2luz1';

export default async function Layout({ children }: { children: React.ReactNode }) {
    // ── 1. Session ──────────────────────────────────────────────────────────
    // The JWT already carries planType + activeModules (refreshed every 60 s
    // in auth.ts).  We use those as the BASELINE — never a hardcoded 'FREE'.
    // The DB read below may upgrade these to the freshest values, but if it
    // fails the session values are already good enough.
    const session  = await auth();
    const userRole = session?.user?.role;
    let   tenantId = session?.user?.tenantId ?? null;
    const isOwner  = tenantId === OWNER_TENANT_ID;
    const isSuperadmin = !!(userRole && PLATFORM_ADMIN_ROLES.includes(userRole as any));

    // Baseline from JWT (never hardcoded FREE)
    let activeModules: string[]               = (session?.user as any)?.activeModules ?? ['INVOICING'];
    let planType: string                      = (session?.user as any)?.planType      ?? 'FREE';
    let lockedDbIds: Record<string, string>   = {};
    let subscriptionStatus: string            = 'ACTIVE';
    let trialEndsAt: string | null            = null;
    let fullTenant: any                       = null;
    let isImpersonating                       = false;

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
            console.error('[layout] cookies() failed during impersonation check:', e);
        }
    }

    // ── 3. Tenant DB read — INDEPENDENT of database fetch ───────────────────
    // Split into two separate try/catch blocks so a failure in one doesn't
    // kill the other. The tenant read is critical (planType, modules), while
    // getGlobalDatabases() is nice-to-have (populates Zustand store).
    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];

    if (tenantId) {
        // 3a. Tenant profile — critical path
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
            });

            if (tenant) {
                // Only override session values if the DB has them
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
            } else {
                console.warn(`[layout] Tenant ${tenantId} not found in DB — using session values (planType=${planType})`);
            }
        } catch (e) {
            console.error(`[layout] Tenant read failed for ${tenantId} — using session values (planType=${planType}):`, e);
            // Session baseline values remain — NOT a hardcoded 'FREE'
        }

        // 3b. Global databases — non-critical, never gates features
        try {
            databases = await getGlobalDatabases();
        } catch (e) {
            console.error('[layout] getGlobalDatabases() failed — Zustand store will hydrate empty:', e);
        }
    } else {
        console.warn('[layout] No tenantId in session — user has no workspace');
    }

    console.log(`[layout] FINAL role=${userRole}, tenantId=${tenantId}, planType=${planType}, modules=${activeModules.length}, impersonating=${isImpersonating}`);

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
