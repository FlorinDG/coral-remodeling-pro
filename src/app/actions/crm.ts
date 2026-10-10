"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { scopeFromSession } from "@/lib/data/scope";
import { isWorkforceRole } from "@/lib/roles";

/**
 * CRM-SCOPE-1 (Planner, unattended 2026-10-10): these six were PUBLIC — no session check — and wrote by id on the raw
 * client: anyone could change or delete any tenant's leads and bookings, in bulk. Now each runs on the session's
 * scoped client (no tenant → refused; another tenant's id → nothing found), and the workforce role is refused
 * (pd.md 4y: the crew reaches the WorkHub and nothing else).
 */
type CrmResult = { success: true } | { success: false; error: string };

async function crmScope() {
    const session = await auth();
    if (!session?.user?.tenantId) return null;
    if (isWorkforceRole((session.user as { role?: string }).role)) return null;
    return scopeFromSession();
}

async function done(count: number): Promise<CrmResult> {
    if (count === 0) return { success: false, error: 'NOT_FOUND' };
    revalidatePath("/[locale]/admin", "layout");
    return { success: true };
}

export async function updateLeadStatus(id: string, status: string): Promise<CrmResult> {
    const db = await crmScope();
    if (!db) return { success: false, error: 'Unauthorized' };
    return done((await db.lead.updateMany({ where: { id }, data: { status } })).count);
}

export async function updateBookingStatus(id: string, status: string): Promise<CrmResult> {
    const db = await crmScope();
    if (!db) return { success: false, error: 'Unauthorized' };
    return done((await db.booking.updateMany({ where: { id }, data: { status } })).count);
}

export async function deleteLead(id: string): Promise<CrmResult> {
    const db = await crmScope();
    if (!db) return { success: false, error: 'Unauthorized' };
    return done((await db.lead.deleteMany({ where: { id } })).count);
}

export async function deleteBooking(id: string): Promise<CrmResult> {
    const db = await crmScope();
    if (!db) return { success: false, error: 'Unauthorized' };
    return done((await db.booking.deleteMany({ where: { id } })).count);
}

export async function bulkDeleteLeads(ids: string[]): Promise<CrmResult> {
    const db = await crmScope();
    if (!db) return { success: false, error: 'Unauthorized' };
    if (!Array.isArray(ids) || ids.length === 0) return { success: true };
    return done((await db.lead.deleteMany({ where: { id: { in: ids } } })).count);
}

export async function bulkDeleteBookings(ids: string[]): Promise<CrmResult> {
    const db = await crmScope();
    if (!db) return { success: false, error: 'Unauthorized' };
    if (!Array.isArray(ids) || ids.length === 0) return { success: true };
    return done((await db.booking.deleteMany({ where: { id: { in: ids } } })).count);
}

export async function getLinkedRecordsForClient(clientId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
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
