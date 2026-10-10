import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { Suspense } from "react";
import DatabaseBootstrap from "@/components/admin/database/DatabaseBootstrap";
import StoreSession from "@/components/admin/database/StoreSession";
import { prepareTenantDatabases } from "@/lib/data/tenant-databases";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { staleSessionReason, staleSessionUrl } from "@/lib/session-guard";
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

        if (session?.user) {
            const user = session.user as any;
            if (user.activeModules) activeModules = user.activeModules;
            if (user.planType)      planType      = user.planType;
        }
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

    // STALE-SESSION-1: found / not found / unknown (read failed) — only a proven absence ends the session.
    let tenantFound: boolean | null = null;
    let userFound: boolean | null = null;
    if (tenantId) {
        // 3a. Tenant profile — critical path
        try {
            // MINIMAL select: only fields the layout actually uses.
            // The settings page fetches the full profile client-side via
            // /api/tenant/profile. Never add columns here that might not
            // exist in all deployments (e.g. creditnoteConnector).
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
                if (tenant.activeModules)      activeModules      = tenant.activeModules;
                if (tenant.planType)           planType           = tenant.planType;
                if (tenant.subscriptionStatus) subscriptionStatus = tenant.subscriptionStatus;
                if (tenant.trialEndsAt)        trialEndsAt        = tenant.trialEndsAt.toISOString();

                try {
                    // KERN-SCHEMA-1: bindings checked + canonical fields, before the schemas load (DatabaseBootstrap)
                    const prepared = await prepareTenantDatabases({ planType, activeModules });
                    lockedDbIds = prepared?.lockedDbIds ?? ((tenant.lockedDbIds as Record<string, string> | null) || {});
                } catch (provErr) {
                    console.error(`[admin/layout] Provisioning failed for ${tenantId}:`, provErr);
                    lockedDbIds = (tenant.lockedDbIds as Record<string, string> | null) || {};
                }

                // JSON round-trip converts Prisma Date objects to ISO strings.
                // Without this, any component that renders {tenant.createdAt}
                // directly in JSX gets React error #301.
                fullTenant = JSON.parse(JSON.stringify(tenant));
                console.log(`[layout] Tenant OK: planType=${planType}, modules=${activeModules.length}, dbs=${Object.keys(lockedDbIds).length}`);
                tenantFound = true;
            } else {
                console.warn(`[layout] Tenant ${tenantId} not found`);
                tenantFound = false;
            }
        } catch (e) {
            console.error(`[layout] Tenant read FAILED for ${tenantId}:`, e);
        }
        if (session?.user?.id) {
            try { userFound = !!(await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })); }
            catch (e) { console.error('[layout] User read FAILED:', e); }
        }

        // 3b. The store's data streams in under <Suspense> (DatabaseBootstrap — MOBILE-PERF-1)
    } else {
        console.warn('[layout] No tenantId — skipping all DB reads');
    }

    // STALE-SESSION-1: a session naming a tenant / user that no longer exists ends (outside any try: redirect throws).
    const stale = staleSessionReason({ tenantFound, userFound, impersonating: isImpersonating });
    if (stale) {
        console.warn(`[layout] stale session (${stale}) — tenant=${tenantId}`);
        redirect(staleSessionUrl(stale));
    }

    return (
        <AuthProvider>
            {/* CACHE-OWNER-1: the store knows who is signed in before any screen reads it */}
            {tenantId && <StoreSession tenantId={tenantId} userId={session?.user?.id} />}
            {tenantId && (
                <Suspense fallback={null}>
                    <DatabaseBootstrap tenantId={tenantId} userId={session?.user?.id} label="admin" />
                </Suspense>
            )}
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
