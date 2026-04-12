"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Server action: fetch a single invoice by its ID (Prisma).
 * Used to hydrate the client-side Zustand store when it doesn't have the page.
 */
export async function getInvoiceById(invoiceId: string) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: "Unauthorized" };

    const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, tenantId },
        include: { items: true },
    });

    if (!invoice) return { success: false, error: "Invoice not found in database" };

    return {
        success: true,
        invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            type: invoice.type,
            status: invoice.status,
            contactId: invoice.contactId,
            supplierId: invoice.supplierId,
            projectId: invoice.projectId,
            issueDate: invoice.issueDate.toISOString(),
            dueDate: invoice.dueDate.toISOString(),
            subtotal: invoice.subtotal,
            vatTotal: invoice.vatTotal,
            total: invoice.total,
            notes: invoice.notes,
        },
    };
}
