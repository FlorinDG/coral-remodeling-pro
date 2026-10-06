/**
 * PROFORMA-1 · a proforma becomes an INVOICE — a second document, never the proforma changed (Florin 2026-10-06:
 * "the proforma and the invoice are two distinct docs"; a client approves the proforma, then is invoiced without
 * the work being done twice). Pure, tested (tests/proforma-invoice.test.ts). The server door is
 * `app/actions/proforma-invoice.ts`.
 *
 * The new invoice is a DRAFT with its OWN number (from the numbering settings — never "Proforma", which the
 * filters then hid) and a link back (`proforma`). It carries what was agreed: client, subject, project, quote,
 * payment terms, delivery date, the lines (fresh ids) and their totals, and the tenant's own fields. It never
 * carries what happened to the proforma (sent / signed / exported stamps, its OGM), nor its dates — the invoice and
 * due dates are stamped when the INVOICE is sent (lib/invoices/due-date resolveInvoiceDatesOnSend).
 */
import { canonicalFieldIds } from '@/lib/kernel/system-schemas';
import { isStampField } from './grid-access';

export const DOC_PROFORMA = 'opt-proforma';
export const DOC_INVOICE = 'opt-invoice';
export const PROFORMA_FIELD = 'proforma';

/** Kernel invoice fields the invoice takes over from its proforma. */
const CARRIED: readonly string[] = ['client', 'betreft', 'project', 'quote', 'prop-payment-method', 'deliveryDate', 'totalExVat', 'totalVat', 'totalIncVat'];

interface Doc { id: string; properties: Record<string, unknown>; blocks?: unknown }

function cloneBlocks(blocks: unknown, newId: () => string): unknown[] {
    if (!Array.isArray(blocks)) return [];
    return blocks.map(b => {
        if (!b || typeof b !== 'object') return b;
        const o = b as Record<string, unknown>;
        return { ...o, id: newId(), ...(Array.isArray(o.children) ? { children: cloneBlocks(o.children, newId) } : {}) };
    });
}

export function invoiceFromProforma(proforma: Doc, ctx: { number: string; newId: () => string }):
    { ok: true; properties: Record<string, unknown>; blocks: unknown[] } | { ok: false; reason: 'not_a_proforma' | 'no_number' } {
    if (proforma.properties.docType !== DOC_PROFORMA) return { ok: false, reason: 'not_a_proforma' };
    if (!ctx.number.trim()) return { ok: false, reason: 'no_number' };
    const kernel = canonicalFieldIds('db-invoices');
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(proforma.properties)) {
        const carried = CARRIED.includes(k) || (!kernel.has(k) && !isStampField(k));   // the tenant's own fields too
        if (carried && v !== undefined) properties[k] = v;
    }
    Object.assign(properties, { title: ctx.number, docType: DOC_INVOICE, status: 'opt-draft', [PROFORMA_FIELD]: [proforma.id] });
    return { ok: true, properties, blocks: cloneBlocks(proforma.blocks, ctx.newId) };
}

/** The invoice made from a proforma, among the invoices database's records — or null. */
export function invoiceOfProforma<P extends { id: string; properties: Record<string, unknown> }>(pages: P[], proformaId: string): P | null {
    return pages.find(p => {
        const v = p.properties[PROFORMA_FIELD];
        return Array.isArray(v) ? v.includes(proformaId) : v === proformaId;
    }) ?? null;
}
