"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function createInternalProject(data: { name: string; budget?: number; startDate?: string; targetEndDate?: string }) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

    // Generate the next project code securely inside the Tenant
    const latestProject = await prisma.internalProject.findFirst({
        where: { tenantId },
        orderBy: { projectCode: 'desc' }
    });

    let nextNum = 1;
    if (latestProject && latestProject.projectCode.startsWith('PRJ-')) {
        const numPart = parseInt(latestProject.projectCode.split('-')[1], 10);
        if (!isNaN(numPart)) {
            nextNum = numPart + 1;
        }
    }

    const projectCode = `PRJ-${String(nextNum).padStart(3, '0')}`;

    const newProject = await prisma.internalProject.create({
        data: {
            projectCode,
            name: data.name,
            budget: data.budget || 0,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            targetEndDate: data.targetEndDate ? new Date(data.targetEndDate) : undefined,
            status: 'PLANNING',
            tenantId
        }
    });

    revalidatePath("/[locale]/admin/projects-management", "layout");
    return { success: true, project: newProject };
}
