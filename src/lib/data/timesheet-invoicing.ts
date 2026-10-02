"use server";
/**
 * TS-INV-1 · hours that went onto an invoice (Florin 2026-10-02: statuses approved · denied · invoiced ·
 * non billable). Marked by hand for now — select hours in Timesheets → "Markeer als gefactureerd",
 * optionally with the invoice; "invoice from hours" will set it itself later.
 *
 * Rules: only tenant HR roles · only APPROVED, BILLABLE, closed hours can be marked · unmarking needs a
 * reason (e.g. a credit note) · every mark/unmark is one AuditLog row per entry, same transaction.
 * Invoiced hours are locked like approved hours (route: unlock + audit), and can be neither denied,
 * made non-billable nor deleted while invoiced.
 */
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { isTenantHrRole } from '@/lib/roles';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';

type Fail = { ok: false; error: string; detail?: string };

async function office() {
    const s = await auth();
    const tenantId = s?.user?.tenantId; const userId = s?.user?.id;
    const role = (s?.user as { role?: string } | undefined)?.role;
    if (!tenantId || !userId) return null;
    return isTenantHrRole(role) ? { tenantId, userId } : null;
}

export interface InvoiceOption { id: string; label: string }

/** The tenant's invoices, newest first — for the optional "on which invoice" picker. */
export async function listInvoicesForHours(): Promise<{ ok: true; invoices: InvoiceOption[] } | Fail> {
    const a = await office();
    if (!a) return { ok: false, error: 'forbidden' };
    const pages = await prisma.globalPage.findMany({
        where: { database: { tenantId: a.tenantId, logicalKey: 'invoices' } },
        select: { id: true, properties: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 300,
    });
    return {
        ok: true,
        invoices: pages.map(p => {
            const props = (p.properties || {}) as Record<string, unknown>;
            const nr = String(props.invoiceNumber || props.number || props['prop-invoice-number'] || '').trim();
            const title = String(props.title || '').trim();
            return { id: p.id, label: [nr, title].filter(Boolean).join(' · ') || p.id.slice(0, 8) };
        }),
    };
}

export async function markHoursInvoiced(entryIds: string[], invoiceRef?: string | null):
    Promise<{ ok: true; marked: number; skipped: number } | Fail> {
    const a = await office();
    if (!a) return { ok: false, error: 'forbidden' };
    const ids = Array.from(new Set(entryIds)).slice(0, 2000);
    if (!ids.length) return { ok: true, marked: 0, skipped: 0 };

    if (invoiceRef) {
        const inv = await prisma.globalPage.findFirst({
            where: { id: invoiceRef, database: { tenantId: a.tenantId, logicalKey: 'invoices' } }, select: { id: true },
        });
        if (!inv) return { ok: false, error: 'invoice_not_found' };
    }

    const eligible = await prisma.clockEntry.findMany({
        where: { id: { in: ids }, tenantId: a.tenantId, approvalStatus: 'approved', billable: true, invoicedAt: null, clockOutTime: { not: null } },
        select: { id: true },
    });
    if (!eligible.length) return { ok: true, marked: 0, skipped: ids.length };

    const at = new Date();
    const data = { invoicedAt: at, invoicedBy: a.userId, invoiceRef: invoiceRef || null };
    try {
        const ops = [prisma.clockEntry.updateMany({ where: { id: { in: eligible.map(e => e.id) }, tenantId: a.tenantId, invoicedAt: null }, data })];
        for (const e of eligible) {
            const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: e.id, action: 'invoice', field: 'invoicedAt',
                before: { invoicedAt: null }, after: { invoicedAt: at.toISOString(), invoiceRef: invoiceRef || null },
            });
            ops.push(buildAuditLogOperation(prisma, audit));
        }
        await prisma.$transaction(ops);
        return { ok: true, marked: eligible.length, skipped: ids.length - eligible.length };
    } catch (err) {
        console.error('[markHoursInvoiced] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}

export async function unmarkHoursInvoiced(entryIds: string[], reason: string):
    Promise<{ ok: true; unmarked: number } | Fail> {
    const a = await office();
    if (!a) return { ok: false, error: 'forbidden' };
    const why = String(reason || '').trim().slice(0, 500);
    if (why.length < 3) return { ok: false, error: 'reason_required' };
    const rows = await prisma.clockEntry.findMany({
        where: { id: { in: Array.from(new Set(entryIds)) }, tenantId: a.tenantId, invoicedAt: { not: null } },
        select: { id: true, invoicedAt: true, invoiceRef: true },
    });
    if (!rows.length) return { ok: true, unmarked: 0 };
    try {
        const ops = [prisma.clockEntry.updateMany({
            where: { id: { in: rows.map(r => r.id) }, tenantId: a.tenantId },
            data: { invoicedAt: null, invoicedBy: null, invoiceRef: null },
        })];
        for (const r of rows) {
            const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: r.id, action: 'uninvoice', field: 'invoicedAt',
                before: { invoicedAt: r.invoicedAt?.toISOString() ?? null, invoiceRef: r.invoiceRef }, after: { invoicedAt: null },
                reason: why,
            });
            ops.push(buildAuditLogOperation(prisma, audit));
        }
        await prisma.$transaction(ops);
        return { ok: true, unmarked: rows.length };
    } catch (err) {
        console.error('[unmarkHoursInvoiced] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}
