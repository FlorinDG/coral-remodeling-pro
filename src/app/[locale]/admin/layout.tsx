import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";

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

    // ── 1. Session — safe fallback: treat as unauthenticated ────────────────
    // Middleware already guards /admin, so if auth() itself throws we still
    // render — the user sees a restricted but working UI, not a 500.
    try {
        const session = await auth();
        tenantId = (session?.user as { tenantId?: string | null })?.tenantId ?? null;
        isOwner  = tenantId === OWNER_TENANT_ID;
    } catch (e) {
        console.error('[layout] auth() failed:', e);
    }

    // ── 2. Tenant data — safe fallback: restricted defaults ─────────────────
    if (tenantId) {
        try {
            const tenant = await prisma.tenant.findUnique({
                where:  { id: tenantId },
                select: { activeModules: true, planType: true, lockedDbIds: true, subscriptionStatus: true, trialEndsAt: true },
            });
            if (tenant?.activeModules) activeModules = tenant.activeModules;
            if (tenant?.planType)      planType       = tenant.planType;
            if (tenant?.subscriptionStatus) subscriptionStatus = tenant.subscriptionStatus;
            if (tenant?.trialEndsAt) trialEndsAt = tenant.trialEndsAt.toISOString();

            const persistedIds = tenant?.lockedDbIds as Record<string, string> | null;
            if (persistedIds && Object.keys(persistedIds).length > 0) {
                lockedDbIds = persistedIds;
            } else {
                // First login — provision locked DBs
                try {
                    lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
                } catch (e) {
                    console.error('[layout] provisionLockedDatabases failed:', e);
                    // Fall through — legacy FOUNDER tenant uses bare IDs
                }
            }
        } catch (e) {
            console.error('[layout] prisma.tenant.findUnique failed:', e);
            // Render with safe defaults — tenant sees restricted but working UI
        }
    }

    // ── 3. Global databases — safe fallback: empty list ─────────────────────
    // GlobalDatabaseSyncer handles an empty array gracefully.
    let databases: Awaited<ReturnType<typeof getGlobalDatabases>> = [];
    try {
        databases = await getGlobalDatabases();
    } catch (e) {
        console.error('[layout] getGlobalDatabases failed:', e);
    }

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} isOwner={isOwner} subscriptionStatus={subscriptionStatus} trialEndsAt={trialEndsAt}>
                {children}
            </AdminLayout>
        </AuthProvider>
    );
}
