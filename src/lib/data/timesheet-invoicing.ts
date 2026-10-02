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
import { createPageServerFirst } from '@/app/actions/pages';
import { getNextDocumentNumber } from '@/app/actions/next-document-number';
import { createPrismaInvoice } from '@/app/actions/create-invoice';
import { computeWorkedDuration, minutesToDecimalHours, formatHoursMinutes } from '@/lib/computeWorkedDuration';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';
import { zonedParts } from '@/lib/kernel/shift-time';
import type { Block, Page } from '@/components/admin/database/types';

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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TS-INV-2 · "Factureer selectie" — the selected hours become a DRAFT invoice (Florin 2026-10-02:
// rate typed in the dialog · one line per worker per day). One client per invoice: the hours'
// projects must all belong to the same client. The hours are marked invoiced, linked to it, in the
// same transaction that writes its lines; the draft opens in the invoice engine for review.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const LABOUR: Record<string, string> = { nl: 'Arbeid', fr: "Main-d'œuvre", en: 'Labour' };
const SUBJECT: Record<string, string> = { nl: 'Werkuren', fr: 'Heures prestées', en: 'Hours worked' };

export async function invoiceSelectedHours(entryIds: string[], hourlyRate: number):
    Promise<{ ok: true; page: Page; invoiced: number; skipped: number } | Fail> {
    const a = await office();
    if (!a) return { ok: false, error: 'forbidden' };
    const rate = Math.round(Number(hourlyRate) * 100) / 100;
    if (!Number.isFinite(rate) || rate <= 0 || rate > 10_000) return { ok: false, error: 'rate_required' };
    const ids = Array.from(new Set(entryIds)).slice(0, 2000);

    const entries = await prisma.clockEntry.findMany({
        where: { id: { in: ids }, tenantId: a.tenantId, approvalStatus: 'approved', billable: true, invoicedAt: null, clockOutTime: { not: null } },
        select: { id: true, userId: true, projectId: true, clockInTime: true, clockOutTime: true, noBreak: true },
        orderBy: { clockInTime: 'asc' },
    });
    if (!entries.length) return { ok: false, error: 'nothing_to_invoice' };

    // ONE client: every entry's project → its client (projects database page, `client` relation).
    const projectIds = Array.from(new Set(entries.map(e => e.projectId).filter(Boolean))) as string[];
    if (entries.some(e => !e.projectId)) return { ok: false, error: 'no_project', detail: String(entries.filter(e => !e.projectId).length) };
    const projects = await prisma.globalPage.findMany({
        where: { id: { in: projectIds }, database: { tenantId: a.tenantId, logicalKey: 'projects' } },
        select: { id: true, properties: true },
    });
    const clientOf = new Map(projects.map(p => {
        const props = (p.properties || {}) as Record<string, unknown>;
        const raw = props.client ?? props['prop-client'];
        const id = Array.isArray(raw) ? String(raw[0] || '') : String(raw || '');
        return [p.id, id];
    }));
    const clients = new Set(projectIds.map(pid => clientOf.get(pid) || ''));
    if (clients.has('')) return { ok: false, error: 'no_client' };
    if (clients.size > 1) return { ok: false, error: 'multiple_clients', detail: String(clients.size) };
    const clientId = Array.from(clients)[0];
    const projectName = (pid: string) => {
        const p = projects.find(x => x.id === pid);
        const props = (p?.properties || {}) as Record<string, unknown>;
        return String(props.title || props.name || '').replace(/^\[ERP\]\s*/i, '').trim();
    };

    const [tenant, users] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: a.tenantId }, select: { documentLanguage: true, defaultVatRate: true } }),
        prisma.user.findMany({ where: { tenantId: a.tenantId, id: { in: Array.from(new Set(entries.map(e => e.userId))) } }, select: { id: true, name: true } }),
    ]);
    const lang = ['nl', 'fr', 'en'].includes(tenant?.documentLanguage || '') ? tenant!.documentLanguage! : 'nl';
    const vat = String(tenant?.defaultVatRate ?? 21);
    const nameOf = new Map(users.map(u => [u.id, u.name || '—']));

    // One line per worker per (Brussels) day.
    const lines = new Map<string, { userId: string; date: string; minutes: number }>();
    for (const e of entries) {
        const date = zonedParts(e.clockInTime).date;
        const key = `${date}|${e.userId}`;
        const minutes = computeWorkedDuration(e.clockInTime, e.clockOutTime, e.noBreak).totalMinutes;
        const l = lines.get(key) || { userId: e.userId, date, minutes: 0 };
        l.minutes += minutes;
        lines.set(key, l);
    }
    const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const blocks: Block[] = Array.from(lines.values())
        .sort((x, y) => x.date.localeCompare(y.date) || (nameOf.get(x.userId) || '').localeCompare(nameOf.get(y.userId) || ''))
        .map(l => {
            const hours = minutesToDecimalHours(l.minutes);   // the same conversion as screen + export
            return {
                id: crypto.randomUUID(),
                type: 'line',
                content: `${LABOUR[lang]} — ${nameOf.get(l.userId)} — ${dm(l.date)} (${formatHoursMinutes(l.minutes)})`,
                quantity: hours,
                unit: 'u',
                unitPrice: rate,
                verkoopPrice: rate,
                vatRate: Number(vat),
                isOptional: false,
                children: [],
            } as Block;
        });
    const totals = calculateInvoiceTotals(blocks, { vatRegime: vat });

    const num = await getNextDocumentNumber('invoice');
    if (!num.success || !num.number) return { ok: false, error: 'numbering_failed', detail: num.error };
    const today = zonedParts(new Date()).date;
    const lastDay = Array.from(lines.values()).map(l => l.date).sort().pop() || today;
    const names = Array.from(new Set(projectIds.map(projectName).filter(Boolean)));
    const created = await createPageServerFirst('db-invoices', {
        title: num.number,
        docType: 'opt-invoice',
        status: 'opt-draft',
        client: [clientId],
        project: projectIds.length === 1 ? [projectIds[0]] : [],
        betreft: `${SUBJECT[lang]}${names.length ? ` — ${names.join(', ')}` : ''}`,
        invoiceDate: today,
        deliveryDate: lastDay,
        vatRegime: vat,
        totalExVat: totals.subtotal,
        totalVat: totals.totalVAT,
        totalIncVat: totals.totalInclVAT,
    });
    if (!created.success) return { ok: false, error: 'invoice_create_failed', detail: created.error };
    const invoiceId = created.page.id;

    // Lines + the hours' status in ONE transaction: never an invoice whose hours look uninvoiced,
    // never hours marked invoiced on an invoice without their lines.
    const at = new Date();
    try {
        const audits = [];
        for (const e of entries) {
            audits.push(await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: e.id, action: 'invoice', field: 'invoicedAt',
                before: { invoicedAt: null }, after: { invoicedAt: at.toISOString(), invoiceRef: invoiceId, rate },
                reason: `invoice ${num.number}`,
            }));
        }
        const [saved] = await prisma.$transaction([
            prisma.globalPage.update({ where: { id: invoiceId }, data: { blocks: blocks as never, blocksVersion: 2 }, select: { updatedAt: true } }),
            prisma.clockEntry.updateMany({
                where: { id: { in: entries.map(e => e.id) }, tenantId: a.tenantId, invoicedAt: null },
                data: { invoicedAt: at, invoicedBy: a.userId, invoiceRef: invoiceId },
            }),
            ...audits.map(x => buildAuditLogOperation(prisma, x)),
        ]);
        await createPrismaInvoice(invoiceId, num.number);
        return {
            ok: true,
            page: { ...created.page, blocks, blocksVersion: 2, updatedAt: (saved as { updatedAt: Date }).updatedAt.toISOString() },
            invoiced: entries.length,
            skipped: ids.length - entries.length,
        };
    } catch (err) {
        console.error('[invoiceSelectedHours] lines/marking failed — draft invoice', invoiceId, 'left without lines:', err);
        return { ok: false, error: 'failed', detail: `${num.number}: ${err instanceof Error ? err.message : String(err)}` };
    }
}

