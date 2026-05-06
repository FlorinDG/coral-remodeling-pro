"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";

import { calculatePeppolOverage } from "@/lib/stripe";

async function verifySuperadmin() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!PLATFORM_ADMIN_ROLES.includes(role)) {
        throw new Error("Unauthorized: Platform admin role required.");
    }
}

export async function updateTenantSubscription(tenantId: string, subscriptionStatus: string, planType: string) {
    await verifySuperadmin();
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus, planType },
    });
    revalidatePath("/superadmin");
}

export async function toggleTenantModule(tenantId: string, moduleName: string, isActive: boolean) {
    await verifySuperadmin();

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { activeModules: true },
    });
    if (!tenant) throw new Error("Tenant not found.");

    let newModules = tenant.activeModules || [];
    if (isActive && !newModules.includes(moduleName)) {
        newModules.push(moduleName);
    } else if (!isActive) {
        newModules = newModules.filter((m: string) => m !== moduleName);
    }

    await prisma.tenant.update({
        where: { id: tenantId },
        data: { activeModules: newModules },
    });
    revalidatePath("/superadmin");
}

export async function resetPeppolCounters(tenantId: string) {
    await verifySuperadmin();
    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            peppolSentThisMonth: 0,
            peppolReceivedThisMonth: 0,
            peppolCounterResetAt: new Date(),
        },
    });
    revalidatePath("/superadmin");
}

export async function deleteTenant(tenantId: string) {
    await verifySuperadmin();

    // Safety Check: Prevent deletion if there are unsettled Peppol overage fees
    const overage = await calculatePeppolOverage(tenantId);
    if (overage > 0) {
        throw new Error(`Cannot delete tenant: Unsettled Peppol overage fees of €${overage.toFixed(2)} detected. These must be paid via Stripe before account closure.`);
    }

    // Cascading deletes are defined in schema — this removes all child records too.
    await prisma.tenant.delete({ where: { id: tenantId } });
    revalidatePath("/superadmin");
}

/** Set the OCR engine for a specific tenant. GPT4O is the default.
 *  Supported: 'GPT4O' | 'MINDEE' | 'VERYFI'
 */
export async function setTenantOcrEngine(tenantId: string, engine: string) {
    await verifySuperadmin();
    const VALID_ENGINES = ['GPT4O', 'MINDEE', 'VERYFI'];
    if (!VALID_ENGINES.includes(engine)) {
        throw new Error(`Invalid OCR engine: ${engine}. Must be one of: ${VALID_ENGINES.join(', ')}`);
    }
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { ocrEngine: engine },
    });
    revalidatePath("/superadmin");
}

/** Override the monthly scan quota for a tenant.
 *  -1 = unlimited (ENTERPRISE), 0 = disabled, positive int = limit.
 */
export async function setTenantScanQuota(tenantId: string, quota: number) {
    await verifySuperadmin();
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { scanQuota: quota },
    });
    revalidatePath("/superadmin");
}

/** Manually reset the scan counter for a tenant (e.g. after a plan upgrade mid-month). */
export async function resetScanCount(tenantId: string) {
    await verifySuperadmin();
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { scanCount: 0, scanCountResetAt: new Date() },
    });
    revalidatePath("/superadmin");
}
export async function updateTenantOcrKeys(tenantId: string, data: { mindeeApiKey?: string | null, veryfiApiKey?: string | null }) {
    await verifySuperadmin();
    await prisma.tenant.update({
        where: { id: tenantId },
        data,
    });
    revalidatePath("/[locale]/superadmin", "layout");
}
