/**
 * Tests for R2-1-B M2: Cron & Background Routes record writes onto the saveRecord door.
 *
 * Covers:
 * 1. buildOverdueInvoiceIntent: delta status intent with by: 'system:cron-overdue' and lifecycle: { reason: 'cron-overdue' }.
 * 2. buildOverdueExpenseIntent: delta status intent with by: 'system:cron-overdue' and lifecycle: { reason: 'cron-overdue' }.
 * 3. Overdue cron update succeeds on accountant-exported invoice (C1: lifecycle permission).
 * 4. Row column preservation on overdue update (assignedTo, order, etc. survive).
 * 5. buildBackfillSupplierCreateData: creates supplier with meta.order, createIfMissing, by: 'system:backfill-peppol', NO lifecycle.
 * 6. Supplier creation via saveRecord verifies row column `order` survives.
 * 7. buildBackfillExpenseUpdateIntent: delta intent with only changed fields and NO lifecycle.
 * 8. Backfill update on accountant-exported expense is refused EXPORT_LOCKED (tamper prevention).
 * 9. Throw Proof 1: Overdue status update on accountant-exported invoice fails EXPORT_LOCKED if lifecycle is omitted.
 * 10. Throw Proof 2: Row column `order` on created supplier is preserved via meta.order.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRecord } from '../src/lib/data/records.ts';
import {
    buildOverdueInvoiceIntent,
    buildOverdueExpenseIntent,
    buildBackfillSupplierCreateData,
    buildBackfillExpenseUpdateIntent,
} from '../src/lib/records/cron-record-intents.ts';

function fakeDb() {
    let clock = 1000;
    const stamp = () => new Date(++clock * 1000);
    const dbs = new Map<string, { id: string; logicalKey: string | null; properties: unknown[] }>([
        ['db-invoices', { id: 'db-invoices', logicalKey: 'invoices', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'totalIncVat', type: 'number' }, { id: 'dueDate', type: 'date' }] }],
        ['db-expenses', { id: 'db-expenses', logicalKey: 'expenses', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'supplier', type: 'relation' }, { id: 'receiptUrl', type: 'text' }] }],
        ['db-suppliers', { id: 'db-suppliers', logicalKey: 'suppliers', properties: [{ id: 'title', type: 'title' }, { id: 'vatNumber', type: 'text' }, { id: 'address', type: 'text' }] }],
    ]);
    const pages = new Map<string, Record<string, any>>();
    const writes: string[] = [];
    const client = {
        globalPage: {
            findFirst: async ({ where }: any) => {
                const p = pages.get(where.id);
                if (!p) return null;
                const dbInfo = dbs.get(p.databaseId);
                return {
                    ...p,
                    database: dbInfo ? { logicalKey: dbInfo.logicalKey, properties: dbInfo.properties } : null,
                };
            },
            create: async ({ data }: any) => {
                const row = { ...data, updatedAt: stamp(), blocksVersion: 1 };
                pages.set(data.id, row);
                writes.push(`create ${data.id}`);
                return row;
            },
            update: async ({ where, data }: any) => {
                const current = pages.get(where.id);
                const row = {
                    ...current,
                    ...data,
                    properties: { ...(current?.properties || {}), ...(data.properties || {}) },
                    updatedAt: stamp(),
                    blocksVersion: (current?.blocksVersion || 1) + 1,
                };
                pages.set(where.id, row);
                writes.push(`update ${where.id}`);
                return row;
            },
        },
        globalDatabase: {
            findFirst: async ({ where }: any) => (dbs.get(where.id) ? { id: where.id } : null),
        },
        $transaction: async (fn: any) => fn(client),
    };
    return { client: client as any, pages, dbs, writes };
}

test('R2-1-B M2: buildOverdueInvoiceIntent constructs delta status intent with by: system:cron-overdue and lifecycle reason', () => {
    const baseVersion = '2026-10-06T06:00:00.000Z';
    const { intent, opts } = buildOverdueInvoiceIntent('inv-100', baseVersion);

    assert.equal(intent.pageId, 'inv-100');
    assert.equal(intent.baseUpdatedAt, baseVersion);
    assert.deepEqual(intent.fields, { status: 'opt-overdue' });
    assert.equal(opts.by, 'system:cron-overdue');
    assert.deepEqual(opts.lifecycle, { reason: 'cron-overdue' });
});

test('R2-1-B M2: buildOverdueExpenseIntent constructs delta status intent with by: system:cron-overdue and lifecycle reason', () => {
    const baseVersion = '2026-10-06T06:00:00.000Z';
    const { intent, opts } = buildOverdueExpenseIntent('exp-200', baseVersion);

    assert.equal(intent.pageId, 'exp-200');
    assert.equal(intent.baseUpdatedAt, baseVersion);
    assert.deepEqual(intent.fields, { status: 'opt-overdue' });
    assert.equal(opts.by, 'system:cron-overdue');
    assert.deepEqual(opts.lifecycle, { reason: 'cron-overdue' });
});

test('R2-1-B M2: overdue invoice update succeeds even on accountant-exported invoice because of lifecycle option', async () => {
    const { client, pages } = fakeDb();
    pages.set('inv-exp-1', {
        id: 'inv-exp-1',
        databaseId: 'db-invoices',
        properties: {
            title: 'Exported Invoice #45',
            status: 'opt-sent',
            totalIncVat: 1200,
            dueDate: '2026-10-01',
            accountantExportedAt: true,
        },
        blocks: [],
        blocksVersion: 1,
        assignedTo: ['worker-1'],
        order: 5,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'system:export',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const { intent, opts } = buildOverdueInvoiceIntent('inv-exp-1', v1);

    const saved = await saveRecord(client, intent, opts);
    assert.ok(saved.ok, 'saveRecord should succeed with lifecycle option');
    assert.equal(pages.get('inv-exp-1')!.properties.status, 'opt-overdue');
    assert.equal(pages.get('inv-exp-1')!.properties.totalIncVat, 1200); // untouched properties stay
    assert.equal(pages.get('inv-exp-1')!.lastEditedBy, 'system:cron-overdue');

    // Row columns survival proof:
    assert.deepEqual(pages.get('inv-exp-1')!.assignedTo, ['worker-1']);
    assert.equal(pages.get('inv-exp-1')!.order, 5);
});

test('R2-1-B M2: buildBackfillSupplierCreateData sets meta.order, createIfMissing, and NO lifecycle (C1)', () => {
    const { intent, opts } = buildBackfillSupplierCreateData('sup-new-1', 'db-suppliers', 12, {
        name: 'Acme Materials BV',
        vat: 'BE0123456789',
        address: 'Havenlaan 10, Brussel',
    });

    assert.equal(intent.pageId, 'sup-new-1');
    assert.deepEqual(intent.fields, {
        title: 'Acme Materials BV',
        vatNumber: 'BE0123456789',
        address: 'Havenlaan 10, Brussel',
    });
    assert.equal(opts.by, 'system:backfill-peppol');
    assert.deepEqual(opts.meta, { order: 12 });
    assert.equal((opts as any).lifecycle, undefined, 'C1: backfill must NEVER have lifecycle');
    assert.deepEqual(opts.createIfMissing, {
        databaseId: 'db-suppliers',
        properties: {
            title: 'Acme Materials BV',
            vatNumber: 'BE0123456789',
            address: 'Havenlaan 10, Brussel',
        },
        blocks: [],
        createdBy: 'system:backfill-peppol',
        assignedTo: [],
    });
});

test('R2-1-B M2: backfill supplier creation preserves row column order via meta.order', async () => {
    const { client, pages } = fakeDb();
    const { intent, opts } = buildBackfillSupplierCreateData('sup-new-2', 'db-suppliers', 42, {
        name: 'Bouw Expert',
        vat: 'BE0987654321',
        address: 'Kerkstraat 1, Gent',
    });

    const saved = await saveRecord(client, intent, opts);
    assert.ok(saved.ok);
    assert.equal(saved.created, true);

    const row = pages.get('sup-new-2')!;
    assert.ok(row, 'row was created');
    assert.equal(row.order, 42, 'row column order was preserved on creation');
    assert.equal(row.createdBy, 'system:backfill-peppol');
    assert.equal(row.lastEditedBy, 'system:backfill-peppol');
    assert.equal(row.properties.title, 'Bouw Expert');
    assert.equal(row.properties.vatNumber, 'BE0987654321');
});

test('R2-1-B M2: buildBackfillExpenseUpdateIntent constructs delta with only changed fields and NO lifecycle', () => {
    const baseVersion = '2026-10-06T07:00:00.000Z';
    const payload = buildBackfillExpenseUpdateIntent('exp-1', baseVersion, {
        supplierId: 'sup-1',
        vendorName: 'Bouw Partner',
        vendorVat: 'BE0111222333',
        receiptUrl: 't_tenant/purchase-invoice/exp-1/doc.pdf',
    });

    assert.ok(payload);
    assert.equal(payload.intent.pageId, 'exp-1');
    assert.equal(payload.intent.baseUpdatedAt, baseVersion);
    assert.deepEqual(payload.intent.fields, {
        supplier: ['sup-1'],
        supplierName: 'Bouw Partner',
        supplierVat: 'BE0111222333',
        receiptUrl: 't_tenant/purchase-invoice/exp-1/doc.pdf',
    });
    assert.equal(payload.opts.by, 'system:backfill-peppol');
    assert.equal((payload.opts as any).lifecycle, undefined, 'C1: backfill must NEVER have lifecycle');
});

test('R2-1-B M2: backfill expense update without lifecycle is refused EXPORT_LOCKED if accountant-exported', async () => {
    const { client, pages } = fakeDb();
    pages.set('exp-locked-1', {
        id: 'exp-locked-1',
        databaseId: 'db-expenses',
        properties: {
            title: 'Exported Expense #12',
            status: 'opt-paid',
            accountantExportedAt: true,
        },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'system:export',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    // Tamper attempt: trying to attach supplier to an already accountant-exported expense
    const payload = buildBackfillExpenseUpdateIntent('exp-locked-1', v1, {
        supplierId: 'sup-new',
        vendorName: 'New Vendor',
    });
    assert.ok(payload);

    const saved = await saveRecord(client, payload.intent, payload.opts);
    assert.equal(saved.ok, false, 'should be refused because expense is accountant-exported and backfill has no lifecycle');
    if (!saved.ok) {
        assert.equal(saved.refusal.code, 'EXPORT_LOCKED');
    }
});

test('R2-1-B M2 Throw Proof 1: removing lifecycle from overdue cron results in EXPORT_LOCKED refusal on exported invoices', async () => {
    const { client, pages } = fakeDb();
    pages.set('inv-tp1', {
        id: 'inv-tp1',
        databaseId: 'db-invoices',
        properties: {
            title: 'Invoice TP1',
            status: 'opt-sent',
            accountantExportedAt: true,
        },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'system:export',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const { intent, opts } = buildOverdueInvoiceIntent('inv-tp1', v1);

    // MUTATION: intentionally strip lifecycle option from the call
    const strippedOpts = { by: opts.by };

    const saved = await saveRecord(client, intent, strippedOpts as any);
    assert.equal(saved.ok, false, 'Without lifecycle, updating status of exported invoice MUST be refused');
    if (!saved.ok) {
        assert.equal(saved.refusal.code, 'EXPORT_LOCKED');
    }
});

test('R2-1-B M2 Throw Proof 2: backfill supplier create preserves order column on the created row', async () => {
    const { client, pages } = fakeDb();
    const { intent, opts } = buildBackfillSupplierCreateData('sup-tp2', 'db-suppliers', 77, {
        name: 'Throw Proof Vendor',
    });

    const saved = await saveRecord(client, intent, opts);
    assert.ok(saved.ok);
    const row = pages.get('sup-tp2')!;
    assert.equal(row.order, 77);

    // MUTATION check: if meta.order was omitted or null, row.order would be null
    const { intent: intent2, opts: opts2 } = buildBackfillSupplierCreateData('sup-tp3', 'db-suppliers', 88, {
        name: 'Vendor 2',
    });
    delete (opts2 as any).meta;
    const saved2 = await saveRecord(client, intent2, opts2);
    assert.ok(saved2.ok);
    assert.equal(pages.get('sup-tp3')!.order, null);
});
