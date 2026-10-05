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
import { scopeFromSession, platformDb } from '@/lib/data/scope';
import { prefillParties, hoursPerWorkerDay } from '@/lib/records/hours-invoice';
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
    const db = await scopeFromSession();   // seraph: the session's tenant, on every read and write
    const pages = await db.globalPage.findMany({
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
    const db = await scopeFromSession();   // seraph: the session's tenant, on every read and write
    const ids = Array.from(new Set(entryIds)).slice(0, 2000);
    if (!ids.length) return { ok: true, marked: 0, skipped: 0 };

    if (invoiceRef) {
        const inv = await db.globalPage.findFirst({
            where: { id: invoiceRef, database: { tenantId: a.tenantId, logicalKey: 'invoices' } }, select: { id: true },
        });
        if (!inv) return { ok: false, error: 'invoice_not_found' };
    }

    const eligible = await db.clockEntry.findMany({
        where: { id: { in: ids }, tenantId: a.tenantId, approvalStatus: 'approved', billable: true, invoicedAt: null, clockOutTime: { not: null } },
        select: { id: true },
    });
    if (!eligible.length) return { ok: true, marked: 0, skipped: ids.length };

    const at = new Date();
    const data = { invoicedAt: at, invoicedBy: a.userId, invoiceRef: invoiceRef || null };
    try {
        const audits: Awaited<ReturnType<typeof buildAuditLogData>>[] = [];
        for (const e of eligible) {
            const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: e.id, action: 'invoice', field: 'invoicedAt',
                before: { invoicedAt: null }, after: { invoicedAt: at.toISOString(), invoiceRef: invoiceRef || null },
            });
            audits.push(audit);
        }
        await db.$transaction(async tx => {
            await tx.clockEntry.updateMany({ where: { id: { in: eligible.map(e => e.id) }, tenantId: a.tenantId, invoicedAt: null }, data });
            for (const x of audits) await buildAuditLogOperation(tx, x);
        }, { timeout: 30_000 });
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
    const db = await scopeFromSession();   // seraph: the session's tenant, on every read and write
    const why = String(reason || '').trim().slice(0, 500);
    if (why.length < 3) return { ok: false, error: 'reason_required' };
    const rows = await db.clockEntry.findMany({
        where: { id: { in: Array.from(new Set(entryIds)) }, tenantId: a.tenantId, invoicedAt: { not: null } },
        select: { id: true, invoicedAt: true, invoiceRef: true },
    });
    if (!rows.length) return { ok: true, unmarked: 0 };
    try {
        const audits: Awaited<ReturnType<typeof buildAuditLogData>>[] = [];
        for (const r of rows) {
            const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: r.id, action: 'uninvoice', field: 'invoicedAt',
                before: { invoicedAt: r.invoicedAt?.toISOString() ?? null, invoiceRef: r.invoiceRef }, after: { invoicedAt: null },
                reason: why,
            });
            audits.push(audit);
        }
        await db.$transaction(async tx => {
            await tx.clockEntry.updateMany({
                where: { id: { in: rows.map(r => r.id) }, tenantId: a.tenantId },
                data: { invoicedAt: null, invoicedBy: null, invoiceRef: null },
            });
            for (const x of audits) await buildAuditLogOperation(tx, x);
        }, { timeout: 30_000 });
        return { ok: true, unmarked: rows.length };
    } catch (err) {
        console.error('[unmarkHoursInvoiced] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TS-INV-2 · "Factureer selectie" — the selected hours become a DRAFT invoice, one line per worker per day,
// UNPRICED: rate, client and project are a person's choice in the invoice editor (Florin 2026-10-05 — no rate
// dialog, no project check; client / project prefilled only when the hours point at exactly one). The hours
// are marked invoiced, linked to it, in the same transaction that writes its lines.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const LABOUR: Record<string, string> = { nl: 'Arbeid', fr: "Main-d'œuvre", en: 'Labour' };
const SUBJECT: Record<string, string> = { nl: 'Werkuren', fr: 'Heures prestées', en: 'Hours worked' };

export async function invoiceSelectedHours(entryIds: string[]):
    Promise<{ ok: true; page: Page; invoiced: number; skipped: number } | Fail> {
    const a = await office();
    if (!a) return { ok: false, error: 'forbidden' };
    const ids = Array.from(new Set(entryIds)).slice(0, 2000);
    // Seraph: every read and write on the session's scoped client (2026-10-05, "guards in place, all over").
    const db = await scopeFromSession();

    const entries = await db.clockEntry.findMany({
        where: { id: { in: ids }, approvalStatus: 'approved', billable: true, invoicedAt: null, clockOutTime: { not: null } },
        select: { id: true, userId: true, projectId: true, clockInTime: true, clockOutTime: true, noBreak: true },
        orderBy: { clockInTime: 'asc' },
    });
    if (!entries.length) return { ok: false, error: 'nothing_to_invoice' };

    // Client / project are PREFILLED when the hours point at exactly one — never a refusal (lib/records/hours-invoice).
    const projectIds = Array.from(new Set(entries.map(e => e.projectId).filter(Boolean))) as string[];
    const projects = projectIds.length
        ? await db.globalPage.findMany({ where: { id: { in: projectIds }, database: { logicalKey: 'projects' } }, select: { id: true, properties: true } })
        : [];
    const clientOf = (pid: string) => {
        const props = (projects.find(p => p.id === pid)?.properties || {}) as Record<string, unknown>;
        const raw = props.client ?? props['prop-client'];
        return Array.isArray(raw) ? String(raw[0] || '') : String(raw || '');
    };
    const { clientId, projectId } = prefillParties(entries, clientOf);
    const projectName = (pid: string) => {
        const props = (projects.find(x => x.id === pid)?.properties || {}) as Record<string, unknown>;
        return String(props.title || props.name || '').replace(/^\[ERP\]\s*/i, '').trim();
    };

    const [tenant, users] = await Promise.all([
        platformDb().tenant.findUnique({ where: { id: a.tenantId }, select: { documentLanguage: true, defaultVatRate: true } }),
        db.user.findMany({ where: { id: { in: Array.from(new Set(entries.map(e => e.userId))) } }, select: { id: true, name: true } }),
    ]);
    const lang = ['nl', 'fr', 'en'].includes(tenant?.documentLanguage || '') ? tenant!.documentLanguage! : 'nl';
    const vat = String(tenant?.defaultVatRate ?? 21);
    const nameOf = new Map(users.map(u => [u.id, u.name || '—']));

    // One line per worker per (Brussels) day. The PRICE is set by a person in the invoice editor (no rate asked).
    const perDay = hoursPerWorkerDay(entries.map(e => ({
        userId: e.userId,
        projectId: e.projectId,
        date: zonedParts(e.clockInTime).date,
        minutes: computeWorkedDuration(e.clockInTime, e.clockOutTime, e.noBreak).totalMinutes,
    })), uid => nameOf.get(uid) || '—');
    const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const blocks: Block[] = perDay.map(l => ({
        id: crypto.randomUUID(),
        type: 'line',
        content: `${LABOUR[lang]} — ${l.name} — ${dm(l.date)} (${formatHoursMinutes(l.minutes)})`,
        quantity: minutesToDecimalHours(l.minutes),   // the same conversion as screen + export
        unit: 'u',
        unitPrice: 0,
        verkoopPrice: 0,
        vatRate: Number(vat),
        isOptional: false,
        children: [],
    } as Block));
    const totals = calculateInvoiceTotals(blocks, { vatRegime: vat });

    const num = await getNextDocumentNumber('invoice');
    if (!num.success || !num.number) return { ok: false, error: 'numbering_failed', detail: num.error };
    const today = zonedParts(new Date()).date;
    const lastDay = perDay.map(l => l.date).sort().pop() || today;
    const names = Array.from(new Set(projectIds.map(projectName).filter(Boolean)));
    const created = await createPageServerFirst('db-invoices', {
        title: num.number,
        docType: 'opt-invoice',
        status: 'opt-draft',
        client: clientId ? [clientId] : [],
        project: projectId ? [projectId] : [],
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

    // Lines + the hours' status in ONE scoped transaction: never an invoice whose hours look uninvoiced,
    // never hours marked invoiced on an invoice without their lines.
    const at = new Date();
    try {
        const audits: Awaited<ReturnType<typeof buildAuditLogData>>[] = [];
        for (const e of entries) {
            audits.push(await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: e.id, action: 'invoice', field: 'invoicedAt',
                before: { invoicedAt: null }, after: { invoicedAt: at.toISOString(), invoiceRef: invoiceId },
                reason: `invoice ${num.number}`,
            }));
        }
        const saved = await db.$transaction(async tx => {
            const page = await tx.globalPage.update({ where: { id: invoiceId }, data: { blocks: blocks as never, blocksVersion: 2 }, select: { updatedAt: true } });
            await tx.clockEntry.updateMany({
                    where: { id: { in: entries.map(e => e.id) }, invoicedAt: null },
                    data: { invoicedAt: at, invoicedBy: a.userId, invoiceRef: invoiceId },
            });
            for (const x of audits) await buildAuditLogOperation(tx, x);
            return page;
        }, { timeout: 30_000 });
        await createPrismaInvoice(invoiceId, num.number);
        return {
            ok: true,
            page: { ...created.page, blocks, blocksVersion: 2, updatedAt: saved.updatedAt.toISOString() },
            invoiced: entries.length,
            skipped: ids.length - entries.length,
        };
    } catch (err) {
        console.error('[invoiceSelectedHours] lines/marking failed — draft invoice', invoiceId, 'left without lines:', err);
        return { ok: false, error: 'failed', detail: `${num.number}: ${err instanceof Error ? err.message : String(err)}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TS-ARCH-1 · archive (Florin 2026-10-02: "store them but remove from the view, always able to bring
// back — the list gets polluted otherwise"). Only SETTLED hours (approved / denied / invoiced, closed):
// archiving pending or running hours would hide unfinished work. Archived hours stay in every export.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function setHoursArchived(entryIds: string[], archived: boolean):
    Promise<{ ok: true; changed: number; skipped: number } | Fail> {
    const a = await office();
    if (!a) return { ok: false, error: 'forbidden' };
    const db = await scopeFromSession();   // seraph: the session's tenant, on every read and write
    const ids = Array.from(new Set(entryIds)).slice(0, 5000);
    const rows = await db.clockEntry.findMany({
        where: archived
            ? { id: { in: ids }, tenantId: a.tenantId, archivedAt: null, clockOutTime: { not: null }, approvalStatus: { in: ['approved', 'denied'] } }
            : { id: { in: ids }, tenantId: a.tenantId, archivedAt: { not: null } },
        select: { id: true },
    });
    if (!rows.length) return { ok: true, changed: 0, skipped: ids.length };
    const at = new Date();
    try {
        const audits: Awaited<ReturnType<typeof buildAuditLogData>>[] = [];
        for (const r of rows) {
            const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
                entityType: 'clockEntry', entityId: r.id, action: archived ? 'archive' : 'restore', field: 'archivedAt',
                before: { archivedAt: archived ? null : 'set' }, after: { archivedAt: archived ? at.toISOString() : null },
            });
            audits.push(audit);
        }
        await db.$transaction(async tx => {
            await tx.clockEntry.updateMany({
                where: { id: { in: rows.map(r => r.id) }, tenantId: a.tenantId },
                data: archived ? { archivedAt: at, archivedBy: a.userId } : { archivedAt: null, archivedBy: null },
            });
            for (const x of audits) await buildAuditLogOperation(tx, x);
        }, { timeout: 30_000 });
        return { ok: true, changed: rows.length, skipped: ids.length - rows.length };
    } catch (err) {
        console.error('[setHoursArchived] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}
