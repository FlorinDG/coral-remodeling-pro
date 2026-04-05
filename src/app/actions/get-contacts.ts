"use server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function getContactsList() {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;

        if (!tenantId) {
            return { success: false, data: [], error: "Unauthorized" };
        }

        const contacts = await prisma.contact.findMany({
            where: { tenantId },
            select: { id: true, firstName: true, lastName: true, email: true, driveFolderId: true },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: contacts };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
