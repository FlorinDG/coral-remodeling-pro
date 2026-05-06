"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function updateLeadStatus(id: string, status: string) {
    await prisma.lead.update({
        where: { id },
        data: { status }
    });
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}

export async function updateBookingStatus(id: string, status: string) {
    await prisma.booking.update({
        where: { id },
        data: { status }
    });
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}
export async function deleteLead(id: string) {
    await prisma.lead.delete({
        where: { id }
    });
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}

export async function deleteBooking(id: string) {
    await prisma.booking.delete({
        where: { id }
    });
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}

export async function bulkDeleteLeads(ids: string[]) {
    await prisma.lead.deleteMany({
        where: { id: { in: ids } }
    });
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}

export async function bulkDeleteBookings(ids: string[]) {
    await prisma.booking.deleteMany({
        where: { id: { in: ids } }
    });
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}
export async function getLinkedRecordsForClient(clientId: string) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        // Fetch InternalProjects
        const projects = await prisma.internalProject.findMany({
            where: { tenantId, clientId },
            select: { id: true, name: true, projectCode: true, status: true },
        });

        // Fetch Quotations
        const quotations = await prisma.quotation.findMany({
            where: { tenantId, contactId: clientId },
            select: { id: true, quoteNumber: true, status: true, total: true },
        });

        // Fetch Invoices
        const invoices = await prisma.invoice.findMany({
            where: { tenantId, contactId: clientId },
            select: { id: true, invoiceNumber: true, status: true, total: true },
        });

        return {
            success: true,
            data: { projects, quotations, invoices }
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
