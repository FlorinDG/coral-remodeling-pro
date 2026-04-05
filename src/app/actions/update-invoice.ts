"use server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function updateInvoiceContact(invoiceId: string, contactId: string) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { contactId: contactId || null }
        });
        return { success: true };
    } catch (e: any) {
        console.error("Failed to update invoice contact:", e);
        return { success: false, error: e.message };
    }
}

export async function updateInvoiceTotals(invoiceId: string, subtotal: number, vatTotal: number, total: number) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { subtotal, vatTotal, total }
        });
        return { success: true };
    } catch (e: any) {
        console.error("Failed to update invoice totals:", e);
        return { success: false, error: e.message };
    }
}
