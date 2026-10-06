/**
 * Pure intent builders and options for Cron and Background Route writes onto the saveRecord door (R2-1-B M2).
 *
 * Rules:
 * - Only changed fields in intent.fields (no spreading existing properties).
 * - Exact caller 'by' tags ('system:cron-overdue', 'system:backfill-peppol').
 * - C1: lifecycle option passed ONLY for overdue cron (reason: 'cron-overdue').
 *       Backfill writes NEVER pass lifecycle.
 * - M2 row columns: order preserved in opts.meta.order for supplier creation.
 */

import type { RecordIntent } from '@/lib/records/record-intent';
import type { RecordMeta, CreateIfMissing } from '@/lib/data/records';

export function buildOverdueInvoiceIntent(
    pageId: string,
    baseUpdatedAt?: string | null
): {
    intent: RecordIntent;
    opts: { by: string; lifecycle: { reason: string } };
} {
    return {
        intent: {
            pageId,
            fields: { status: 'opt-overdue' },
            baseUpdatedAt: baseUpdatedAt ?? null,
        },
        opts: {
            by: 'system:cron-overdue',
            lifecycle: { reason: 'cron-overdue' },
        },
    };
}

export function buildOverdueExpenseIntent(
    pageId: string,
    baseUpdatedAt?: string | null
): {
    intent: RecordIntent;
    opts: { by: string; lifecycle: { reason: string } };
} {
    return {
        intent: {
            pageId,
            fields: { status: 'opt-overdue' },
            baseUpdatedAt: baseUpdatedAt ?? null,
        },
        opts: {
            by: 'system:cron-overdue',
            lifecycle: { reason: 'cron-overdue' },
        },
    };
}

export interface BackfillSupplierInput {
    name?: string | null;
    vat?: string | null;
    address?: string | null;
}

export function buildBackfillSupplierCreateData(
    supplierId: string,
    databaseId: string,
    order: number,
    vendor: BackfillSupplierInput
): {
    intent: RecordIntent;
    opts: {
        by: string;
        meta: RecordMeta;
        createIfMissing: CreateIfMissing;
    };
} {
    const properties: Record<string, unknown> = {
        title: vendor.name || 'Unknown Supplier',
        vatNumber: vendor.vat || null,
        address: vendor.address || '',
    };
    return {
        intent: {
            pageId: supplierId,
            fields: properties,
        },
        opts: {
            by: 'system:backfill-peppol',
            meta: { order },
            createIfMissing: {
                databaseId,
                properties,
                blocks: [],
                createdBy: 'system:backfill-peppol',
                assignedTo: [],
            },
        },
    };
}

export interface BackfillExpenseDelta {
    supplierId?: string | null;
    vendorName?: string | null;
    vendorVat?: string | null;
    receiptUrl?: string | null;
    blocks?: unknown[];
}

export function buildBackfillExpenseUpdateIntent(
    pageId: string,
    baseUpdatedAt: string | null | undefined,
    delta: BackfillExpenseDelta
): {
    intent: RecordIntent;
    opts: { by: string };
} | null {
    const fields: Record<string, unknown> = {};
    if (delta.supplierId) {
        fields.supplier = [delta.supplierId];
        if (delta.vendorName) fields.supplierName = delta.vendorName;
        if (delta.vendorVat) fields.supplierVat = delta.vendorVat;
    }
    if (delta.receiptUrl) {
        fields.receiptUrl = delta.receiptUrl;
    }

    const hasFields = Object.keys(fields).length > 0;
    const hasBlocks = delta.blocks !== undefined && delta.blocks.length > 0;

    if (!hasFields && !hasBlocks) return null;

    const intent: RecordIntent = {
        pageId,
        fields,
        baseUpdatedAt: baseUpdatedAt ?? null,
    };
    if (hasBlocks) {
        intent.blocks = delta.blocks;
    }

    return {
        intent,
        opts: { by: 'system:backfill-peppol' },
    };
}
