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
