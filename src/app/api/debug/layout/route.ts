import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Diagnostic endpoint: /api/debug/layout
 * Returns exactly what the admin layout would compute.
 * Hit this URL in the browser to see if auth, tenant, and DB reads work.
 */
export async function GET() {
    const result: Record<string, any> = {
        timestamp: new Date().toISOString(),
        auth: null,
        tenant: null,
        databases: null,
        error: null,
    };

    try {
        const session = await auth();
        result.auth = {
            role: session?.user?.role,
            tenantId: session?.user?.tenantId,
            planType: (session?.user as any)?.planType,
            activeModules: (session?.user as any)?.activeModules,
            email: session?.user?.email,
        };

        const tenantId = session?.user?.tenantId;
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    id: true,
                    companyName: true,
                    planType: true,
                    activeModules: true,
                    lockedDbIds: true,
                    subscriptionStatus: true,
                },
            });
            result.tenant = tenant;

            // Count databases
            const dbCount = await prisma.globalDatabase.count({
                where: { tenantId },
            });
            result.databases = { count: dbCount };
        }
    } catch (e: any) {
        result.error = e.message;
    }

    return NextResponse.json(result, { status: 200 });
}
