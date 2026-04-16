"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";

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
        newModules = newModules.filter((m) => m !== moduleName);
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
    // Cascading deletes are defined in schema — this removes all child records too.
    await prisma.tenant.delete({ where: { id: tenantId } });
    revalidatePath("/superadmin");
}
