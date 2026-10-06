"use server";
/**
 * PROFORMA-1 · "Factureren" on a proforma: a NEW draft invoice made from it (lib/records/proforma-invoice), on the
 * caller's scoped door. The proforma itself is never changed — it stays the document the client approved.
 * Session → scoped client → the record door (saveRecord). A proforma is invoiced once: a second click opens the
 * invoice it already has.
 */
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/auth';
import { isWorkforceRole } from '@/lib/roles';
import { scopeFromSession } from '@/lib/data/scope';
import { saveRecord } from '@/lib/data/records';
import { gridAccess } from '@/lib/records/grid-access';
import { invoiceFromProforma, PROFORMA_FIELD } from '@/lib/records/proforma-invoice';
import { getNextDocumentNumber } from '@/app/actions/next-document-number';
import { createPrismaInvoice } from '@/app/actions/create-invoice';

export type ProformaInvoiceAnswer =
    | { ok: true; invoiceId: string; existed: boolean; page?: { id: string; databaseId: string; properties: Record<string, unknown>; blocks: unknown[]; blocksVersion: number; updatedAt: string } }
    | { ok: false; error: 'forbidden' | 'not_found' | 'not_a_proforma' | 'no_number' | 'failed' };

export async function createInvoiceFromProforma(proformaId: string): Promise<ProformaInvoiceAnswer> {
    const session = await auth();
    const userId = session?.user?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session?.user?.tenantId || !userId || isWorkforceRole(role)) return { ok: false, error: 'forbidden' };
    // who may create records here — the ONE rule (the accountant reads)
    if (!gridAccess({ userRole: role, logicalKey: 'invoices', isEnterprise: true }).create) return { ok: false, error: 'forbidden' };

    const db = await scopeFromSession();
    const proforma = await db.globalPage.findFirst({
        where: { id: proformaId, database: { logicalKey: 'invoices' } },
        select: { id: true, databaseId: true, properties: true, blocks: true },
    });
    if (!proforma) return { ok: false, error: 'not_found' };
    const props = (proforma.properties || {}) as Record<string, unknown>;
    if (props.docType !== 'opt-proforma') return { ok: false, error: 'not_a_proforma' };

    // Invoiced once: the invoice that already links this proforma is the answer.
    const existing = await db.globalPage.findFirst({
        where: { databaseId: proforma.databaseId, properties: { path: [PROFORMA_FIELD], array_contains: proformaId } },
        select: { id: true },
    });
    if (existing) return { ok: true, invoiceId: existing.id, existed: true };

    const num = await getNextDocumentNumber('invoice');
    if (!num.success || !num.number) return { ok: false, error: 'no_number' };

    const built = invoiceFromProforma({ id: proforma.id, properties: props, blocks: proforma.blocks }, { number: num.number, newId: uuidv4 });
    if (!built.ok) return { ok: false, error: built.reason };

    const invoiceId = uuidv4();
    const saved = await saveRecord(db, { pageId: invoiceId, fields: built.properties, blocks: built.blocks as never }, {
        by: userId,
        createIfMissing: { databaseId: proforma.databaseId, properties: built.properties, blocks: built.blocks, createdBy: userId },
    });
    if (!saved.ok) {
        console.error('[proforma-invoice] the record door refused:', saved.refusal);
        return { ok: false, error: 'failed' };
    }
    // The invoice ledger row (numbering, payments) — as every other invoice creation does.
    const ledger = await createPrismaInvoice(invoiceId, num.number);
    if (!ledger.success) console.error('[proforma-invoice] invoice ledger row not created:', ledger.error);

    return {
        ok: true, invoiceId, existed: false,
        page: { id: invoiceId, databaseId: proforma.databaseId, properties: saved.properties, blocks: built.blocks, blocksVersion: saved.blocksVersion, updatedAt: saved.updatedAt },
    };
}
