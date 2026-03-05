"use server";

import prisma from "@/lib/prisma";
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
