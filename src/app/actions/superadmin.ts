"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

async function verifySuperadmin() {
    const session = await auth();
    if ((session?.user as any)?.role !== "SUPERADMIN") {
        throw new Error("Unauthorized Access: Superadmin permission required.");
    }
}

export async function updateTenantSubscription(tenantId: string, subscriptionStatus: string, planType: string) {
    await verifySuperadmin();

    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            subscriptionStatus,
            planType,
        }
    });

    revalidatePath("/superadmin");
}

export async function toggleTenantModule(tenantId: string, moduleName: string, isActive: boolean) {
    await verifySuperadmin();

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { activeModules: true }
    });

    if (!tenant) throw new Error("Tenant not found.");

    let newModules = tenant.activeModules || [];

    if (isActive && !newModules.includes(moduleName)) {
        newModules.push(moduleName);
    } else if (!isActive) {
        newModules = newModules.filter(m => m !== moduleName);
    }

    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            activeModules: newModules
        }
    });

    revalidatePath("/superadmin");
}
