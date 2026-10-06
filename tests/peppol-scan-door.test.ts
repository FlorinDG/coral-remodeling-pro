/**
 * R2-1-B Milestone 3 Characterization Tests: Peppol Inbox & Scan routes onto saveRecord door.
 *
 * Verifies:
 * - Proper delta intent and options construction for Peppol supplier and expense creation.
 * - Proper intent and options for Scan update and create.
 * - Planner Review M2 Note 2: supplier creation uses canonical field 'vat' (NOT 'vatNumber').
 * - C1: NO lifecycle on any of these writers (lifecycle is strictly for cron-overdue and invoice-payments).
 * - Row columns preserved: 'order' carried via opts.meta.order on creation.
 * - Error/refusal handling through saveRecord.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPeppolSupplierCreateData,
    buildPeppolExpenseCreateData,
    buildScanUpdateIntent,
    buildScanCreateData,
} from '../src/lib/records/peppol-scan-intents.ts';
import { saveRecord } from '../src/lib/data/records.ts';
import type { TenantScopedClient } from '../src/lib/data/scope.ts';

function fakeDb() {
    const dbs = new Map<string, { id: string; logicalKey: string | null; properties: unknown[] }>([
        ['db-expenses', { id: 'db-expenses', logicalKey: 'expenses', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'supplier', type: 'relation' }, { id: 'receiptUrl', type: 'text' }] }],
        ['db-suppliers', { id: 'db-suppliers', logicalKey: 'suppliers', properties: [{ id: 'title', type: 'title' }, { id: 'vat', type: 'text' }, { id: 'address', type: 'text' }] }],
    ]);
    const pages = new Map<string, Record<string, any>>();
    const writes: string[] = [];

    const tx = {
        globalDatabase: {
            findFirst: async ({ where }: any) => dbs.get(where.id) || null,
        },
        globalPage: {
            findFirst: async ({ where, select }: any) => {
                const p = pages.get(where.id);
                if (!p) return null;
                const db = dbs.get(p.databaseId);
                return {
                    id: p.id,
                    properties: p.properties,
                    blocks: p.blocks ?? [],
                    blocksVersion: p.blocksVersion ?? 1,
                    updatedAt: p.updatedAt,
                    lastEditedBy: p.lastEditedBy,
                    order: p.order,
                    database: db ? { logicalKey: db.logicalKey, properties: db.properties } : null,
                };
            },
            create: async ({ data, select }: any) => {
                writes.push(`create:${data.id}`);
                const row = {
                    ...data,
                    updatedAt: new Date('2026-10-06T07:30:00Z'),
                    createdAt: new Date('2026-10-06T07:30:00Z'),
                };
                pages.set(data.id, row);
                return {
                    id: row.id,
                    updatedAt: row.updatedAt,
                    blocksVersion: row.blocksVersion,
                    properties: row.properties,
                };
            },
            update: async ({ where, data, select }: any) => {
                writes.push(`update:${where.id}`);
                const existing = pages.get(where.id);
                if (!existing) throw new Error('Not found');
                const updated = {
                    ...existing,
                    ...data,
                    properties: data.properties !== undefined ? data.properties : existing.properties,
                    updatedAt: new Date('2026-10-06T07:35:00Z'),
                    blocksVersion: (existing.blocksVersion ?? 1) + 1,
                };
                pages.set(where.id, updated);
                return {
                    id: updated.id,
                    updatedAt: updated.updatedAt,
                    blocksVersion: updated.blocksVersion,
                    properties: updated.properties,
                };
            },
        },
    };

    const client = {
        $transaction: async (fn: any) => fn(tx),
    } as unknown as TenantScopedClient;

    return { client, pages, writes, dbs };
}

// ── 1. Peppol Supplier Intent Tests ──────────────────────────────────────────

test('R2-1-B M3: buildPeppolSupplierCreateData uses canonical "vat" field (Note 2) and by: system:peppol', () => {
    const { intent, opts } = buildPeppolSupplierCreateData('sup-peppol-1', 'db-suppliers', 7, {
        name: 'Belgocontrol NV',
        vat: 'BE0202239951',
        address: 'Tervuursesteenweg 303',
        email: 'billing@belgocontrol.be',
        city: 'Steenokkerzeel',
        postal: '1820',
        country: 'BE',
    });

    assert.equal(intent.pageId, 'sup-peppol-1');
    assert.deepEqual(intent.fields, {
        title: 'Belgocontrol NV',
        vat: 'BE0202239951',
        address: 'Tervuursesteenweg 303',
        email: 'billing@belgocontrol.be',
        phone: '',
        contact_person: '',
        city: 'Steenokkerzeel',
        postal: '1820',
        country: 'BE',
    });
    // Note 2: assert vat is used, NOT vatNumber
    assert.equal((intent.fields as any).vatNumber, undefined, 'Note 2: must NEVER set legacy vatNumber');

    assert.equal(opts.by, 'system:peppol');
    assert.deepEqual(opts.meta, { order: 7 });
    assert.equal((opts as any).lifecycle, undefined, 'C1: Peppol supplier creation must NEVER pass lifecycle');

    assert.deepEqual(opts.createIfMissing, {
        databaseId: 'db-suppliers',
        properties: {
            title: 'Belgocontrol NV',
            vat: 'BE0202239951',
            address: 'Tervuursesteenweg 303',
            email: 'billing@belgocontrol.be',
            phone: '',
            contact_person: '',
            city: 'Steenokkerzeel',
            postal: '1820',
            country: 'BE',
        },
        blocks: [],
        createdBy: 'system:peppol',
        assignedTo: [],
    });
});

test('R2-1-B M3: Peppol supplier creation preserves row column order via meta.order in saveRecord', async () => {
    const { client, pages } = fakeDb();
    const { intent, opts } = buildPeppolSupplierCreateData('sup-peppol-2', 'db-suppliers', 15, {
        name: 'Proximus NV',
        vat: 'BE0202548325',
    });

    const res = await saveRecord(client, intent, opts);
    assert.ok(res.ok);
    assert.equal(res.created, true);

    const row = pages.get('sup-peppol-2')!;
    assert.ok(row);
    assert.equal(row.order, 15, 'row column order was preserved on creation');
    assert.equal(row.createdBy, 'system:peppol');
    assert.equal(row.lastEditedBy, 'system:peppol');
    assert.equal(row.properties.vat, 'BE0202548325');
});

// ── 2. Peppol Expense Intent Tests ───────────────────────────────────────────

test('R2-1-B M3: buildPeppolExpenseCreateData carries structured fields and blocks without lifecycle', () => {
    const blocks = [{ id: 'blk-1', type: 'financial-row', content: 'Fiber internet', properties: { lineTotal: 100 } }];
    const { intent, opts } = buildPeppolExpenseCreateData(
        'exp-peppol-1',
        'db-expenses',
        3,
        {
            title: 'INV-2026-001',
            docType: 'opt-invoice',
            totalExVat: 100,
            totalVat: 21,
            totalIncVat: 121,
            peppolDocId: 'peppol-doc-xyz',
            supplierName: 'Proximus NV',
            supplier: ['sup-peppol-2'],
            receiptUrl: 't_ten/purchase-invoice/exp-peppol-1/invoice.pdf',
        },
        blocks
    );

    assert.equal(intent.pageId, 'exp-peppol-1');
    assert.equal(intent.fields.title, 'INV-2026-001');
    assert.equal(intent.fields.source, 'src-peppol');
    assert.equal(intent.fields.docType, 'opt-invoice');
    assert.equal(intent.fields.status, 'opt-unpaid');
    assert.equal(opts.by, 'system:peppol');
    assert.deepEqual(opts.meta, { order: 3 });
    assert.equal((opts as any).lifecycle, undefined, 'C1: Peppol expense create must NEVER pass lifecycle');
    assert.deepEqual(opts.createIfMissing.blocks, blocks);
});

test('R2-1-B M3: Peppol expense creation persists record with blocksVersion 1', async () => {
    const { client, pages } = fakeDb();
    const blocks = [{ id: 'blk-1', type: 'financial-row', content: 'Materials' }];
    const { intent, opts } = buildPeppolExpenseCreateData(
        'exp-peppol-2',
        'db-expenses',
        0,
        {
            title: 'INV-2026-999',
            docType: 'opt-invoice',
            totalExVat: 50,
            totalVat: 10.5,
            totalIncVat: 60.5,
            peppolDocId: 'peppol-doc-abc',
        },
        blocks
    );

    const res = await saveRecord(client, intent, opts);
    assert.ok(res.ok);
    assert.equal(res.created, true);
    assert.equal(res.blocksVersion, 1);

    const row = pages.get('exp-peppol-2')!;
    assert.ok(row);
    assert.equal(row.createdBy, 'system:peppol');
    assert.equal(row.lastEditedBy, 'system:peppol');
    assert.deepEqual(row.blocks, blocks);
});

// ── 3. Scan Route Intent Tests ───────────────────────────────────────────────

test('R2-1-B M3: buildScanUpdateIntent constructs delta for existing page with by: system:scan', () => {
    const { intent, opts } = buildScanUpdateIntent('exp-scan-1', {
        title: 'Scanned Invoice #123',
        totalIncVat: 121,
        reviewStatus: 'Na te kijken',
    });

    assert.equal(intent.pageId, 'exp-scan-1');
    assert.deepEqual(intent.fields, {
        title: 'Scanned Invoice #123',
        totalIncVat: 121,
        reviewStatus: 'Na te kijken',
    });
    assert.equal(opts.by, 'system:scan');
    assert.equal((opts as any).lifecycle, undefined, 'C1: Scan update must NEVER pass lifecycle');
});

test('R2-1-B M3: buildScanCreateData sets order: 0, by: system:scan and creates cleanly', async () => {
    const { client, pages } = fakeDb();
    const { intent, opts } = buildScanCreateData('exp-scan-new', 'db-expenses', {
        title: 'New Scan #456',
        totalIncVat: 200,
        source: 'src-scan',
    });

    assert.equal(intent.pageId, 'exp-scan-new');
    assert.equal(opts.by, 'system:scan');
    assert.deepEqual(opts.meta, { order: 0 });
    assert.equal((opts as any).lifecycle, undefined, 'C1: Scan create must NEVER pass lifecycle');

    const res = await saveRecord(client, intent, opts);
    assert.ok(res.ok);
    assert.equal(res.created, true);

    const row = pages.get('exp-scan-new')!;
    assert.ok(row);
    assert.equal(row.order, 0);
    assert.equal(row.createdBy, 'system:scan');
    assert.equal(row.lastEditedBy, 'system:scan');
});

// ── 4. Refusal Handling & Throw Proofs ────────────────────────────────────────

test('R2-1-B M3 Throw Proof: scan update on accountant-exported expense is refused EXPORT_LOCKED', async () => {
    const { client, pages } = fakeDb();
    pages.set('exp-locked-1', {
        id: 'exp-locked-1',
        databaseId: 'db-expenses',
        properties: {
            title: 'Locked Expense',
            accountantExportedAt: true,
            status: 'opt-unpaid',
        },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date('2026-09-30T23:59:59Z'),
        lastEditedBy: 'user-1',
        order: 0,
    });

    const { intent, opts } = buildScanUpdateIntent('exp-locked-1', {
        title: 'Attempted Scan Overwrite',
    });

    const res = await saveRecord(client, intent, opts);
    assert.equal(res.ok, false);
    assert.equal((res as any).refusal.code, 'EXPORT_LOCKED');
});
