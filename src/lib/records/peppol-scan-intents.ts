/**
 * Pure intent builders and options for Peppol Inbox and Scan route writes onto the saveRecord door (R2-1-B M3).
 *
 * Rules:
 * - Only changed fields in delta / intent.fields.
 * - Exact caller 'by' tags ('system:peppol', 'system:scan').
 * - C1: NO lifecycle on these writes (lifecycle is strictly for overdue cron and invoice payments).
 * - Planner Review M2 Note 2: supplier creation uses canonical kernel field 'vat' (VAT_FIELD in vat-lookup.ts),
 *   never 'vatNumber'.
 * - Row columns preserved: 'order' carried via opts.meta.order.
 */

import type { RecordIntent } from '@/lib/records/record-intent';
import type { RecordMeta, CreateIfMissing } from '@/lib/data/records';

export interface PeppolSupplierInput {
    name?: string | null;
    vat?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    contact?: string | null;
    city?: string | null;
    postal?: string | null;
    country?: string | null;
}

export function buildPeppolSupplierCreateData(
    supplierId: string,
    databaseId: string,
    order: number,
    parsed: PeppolSupplierInput
): {
    intent: RecordIntent;
    opts: {
        by: string;
        meta: RecordMeta;
        createIfMissing: CreateIfMissing;
    };
} {
    const properties: Record<string, unknown> = {
        title: parsed.name || 'Unknown Supplier',
        vat: parsed.vat || null,
        address: parsed.address || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        contact_person: parsed.contact || '',
        city: parsed.city || '',
        postal: parsed.postal || '',
        country: parsed.country || '',
    };

    return {
        intent: {
            pageId: supplierId,
            fields: properties,
        },
        opts: {
            by: 'system:peppol',
            meta: { order },
            createIfMissing: {
                databaseId,
                properties,
                blocks: [],
                createdBy: 'system:peppol',
                assignedTo: [],
            },
        },
    };
}

export interface PeppolExpenseInput {
    title: string;
    betreft?: string;
    ogm?: string;
    contact?: string;
    docType: 'opt-invoice' | 'opt-credit-note';
    status?: string;
    invoiceDate?: string;
    dueDate?: string;
    totalExVat: number;
    totalVat: number;
    totalIncVat: number;
    peppolDocId: string;
    invoiceLines?: string;
    supplierName?: string;
    supplierVat?: string;
    supplier?: string[];
    receiptUrl?: string;
}

export function buildPeppolExpenseCreateData(
    pageId: string,
    databaseId: string,
    order: number,
    data: PeppolExpenseInput,
    blocks: unknown[] = []
): {
    intent: RecordIntent;
    opts: {
        by: string;
        meta: RecordMeta;
        createIfMissing: CreateIfMissing;
    };
} {
    const properties: Record<string, unknown> = {
        title: data.title,
        betreft: data.betreft || '',
        ogm: data.ogm || '',
        contact: data.contact || '',
        source: 'src-peppol',
        docType: data.docType,
        status: data.status || 'opt-unpaid',
        invoiceDate: data.invoiceDate || '',
        dueDate: data.dueDate || '',
        totalExVat: data.totalExVat,
        totalVat: data.totalVat,
        totalIncVat: data.totalIncVat,
        peppolDocId: data.peppolDocId,
        invoiceLines: data.invoiceLines || '[]',
        supplierName: data.supplierName || '',
        supplierVat: data.supplierVat || '',
        supplier: data.supplier || [],
        receiptUrl: data.receiptUrl || '',
    };

    return {
        intent: {
            pageId,
            fields: properties,
        },
        opts: {
            by: 'system:peppol',
            meta: { order },
            createIfMissing: {
                databaseId,
                properties,
                blocks,
                createdBy: 'system:peppol',
                assignedTo: [],
            },
        },
    };
}

export function buildScanUpdateIntent(
    pageId: string,
    properties: Record<string, unknown>,
    baseUpdatedAt?: string | null
): {
    intent: RecordIntent;
    opts: { by: string };
} {
    return {
        intent: {
            pageId,
            fields: properties,
            baseUpdatedAt: baseUpdatedAt ?? null,
        },
        opts: {
            by: 'system:scan',
        },
    };
}

export function buildScanCreateData(
    pageId: string,
    databaseId: string,
    properties: Record<string, unknown>,
    order = 0
): {
    intent: RecordIntent;
    opts: {
        by: string;
        meta: RecordMeta;
        createIfMissing: CreateIfMissing;
    };
} {
    return {
        intent: {
            pageId,
            fields: properties,
        },
        opts: {
            by: 'system:scan',
            meta: { order },
            createIfMissing: {
                databaseId,
                properties,
                blocks: [],
                createdBy: 'system:scan',
                assignedTo: [],
            },
        },
    };
}
