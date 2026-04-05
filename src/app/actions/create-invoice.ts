"use server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function createPrismaInvoice(id: string, invoiceNumber: string) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

        await prisma.invoice.create({
            data: {
                id,
                invoiceNumber,
                type: 'SALES',
                status: 'DRAFT',
                issueDate: new Date(),
                dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                subtotal: 0,
                vatTotal: 0,
                total: 0,
                tenantId
            }
        });
        return { success: true };
    } catch (e: any) {
        console.error("Failed to create Prisma invoice:", e);
        return { success: false, error: e.message };
    }
}
