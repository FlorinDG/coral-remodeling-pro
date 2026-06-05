import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { provisionLockedDatabases } from "@/lib/provisionTenantDbs";
import { cookies } from "next/headers";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * Diagnostic: execute the EXACT same logic as admin/layout.tsx
 * and report step-by-step results.
 */
export async function GET() {
    const steps: Record<string, any> = {};

    // Step 1: auth
    let tenantId: string | null = null;
    try {
        const session = await auth();
        tenantId = session?.user?.tenantId ?? null;
        const userRole = session?.user?.role;
        const isSuperadmin = !!(userRole && PLATFORM_ADMIN_ROLES.includes(userRole as any));
        steps.auth = { tenantId, userRole, isSuperadmin };

        // Impersonation
        if (isSuperadmin) {
            const cookieStore = await cookies();
            const imp = cookieStore.get('x-impersonate-tenant')?.value;
            if (imp) {
                tenantId = imp;
                steps.auth.impersonatedTo = imp;
            }
        }
    } catch (e: any) {
        steps.auth = { error: e.message };
    }

    // Step 2: tenant read with omit (EXACT same as layout)
    if (tenantId) {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                omit: { logoUrl: true, stationeryUrl: true },
            });
            steps.tenantQuery = tenant ? 'OK' : 'NOT_FOUND';

            if (tenant) {
                steps.tenantFields = {
                    companyName: tenant.companyName,
                    planType: tenant.planType,
                    modulesCount: tenant.activeModules?.length,
                    lockedDbIdsCount: Object.keys((tenant.lockedDbIds as any) || {}).length,
                    trialEndsAt: tenant.trialEndsAt,
                    trialEndsAtType: typeof tenant.trialEndsAt,
                    subscriptionStatus: tenant.subscriptionStatus,
                };

                // Exact same logic as layout lines 75-90
                try {
                    if (tenant.trialEndsAt) {
                        steps.trialEndsAtIso = tenant.trialEndsAt.toISOString();
                    }

                    const persistedIds = tenant.lockedDbIds as Record<string, string> | null;
                    if (persistedIds && Object.keys(persistedIds).length > 0) {
                        steps.lockedDbIds = Object.keys(persistedIds).length;
                    } else {
                        const provisioned = await provisionLockedDatabases(tenantId, prisma);
                        steps.lockedDbIds = Object.keys(provisioned).length;
                        steps.lockedDbIdsSource = 'provisioned';
                    }

                    const fullTenant = JSON.parse(JSON.stringify(tenant));
                    steps.serialization = 'OK';
                    steps.serializedSize = JSON.stringify(fullTenant).length;
                } catch (e: any) {
                    steps.innerError = { message: e.message, stack: e.stack?.split('\n').slice(0, 3) };
                }
            }
        } catch (e: any) {
            steps.tenantQuery = { error: e.message, stack: e.stack?.split('\n').slice(0, 3) };
        }
    }

    return NextResponse.json(steps, { status: 200 });
}
