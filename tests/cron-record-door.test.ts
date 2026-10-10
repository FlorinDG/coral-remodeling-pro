/**
 * Tests for R2-1-B M2: Cron & Background Routes record writes onto the saveRecord door.
 *
 * Covers:
 * 1. buildOverdueInvoiceIntent: delta status intent with by: 'system:cron-overdue' and lifecycle: { reason: 'cron-overdue' }.
 * 2. buildOverdueExpenseIntent: delta status intent with by: 'system:cron-overdue' and lifecycle: { reason: 'cron-overdue' }.
 * 3. Overdue cron update succeeds on accountant-exported invoice (C1: lifecycle permission).
 * 4. Row column preservation on overdue update (assignedTo, order, etc. survive).
 * 9. Throw Proof 1: Overdue status update on accountant-exported invoice fails EXPORT_LOCKED if lifecycle is omitted.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRecord } from '../src/lib/data/records.ts';
import {
    buildOverdueInvoiceIntent,
    buildOverdueExpenseIntent,
} from '../src/lib/records/cron-record-intents.ts';

function fakeDb() {
    let clock = 1000;
    const stamp = () => new Date(++clock * 1000);
    const dbs = new Map<string, { id: string; logicalKey: string | null; properties: unknown[] }>([
        ['db-invoices', { id: 'db-invoices', logicalKey: 'invoices', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'totalIncVat', type: 'number' }, { id: 'dueDate', type: 'date' }] }],
        ['db-expenses', { id: 'db-expenses', logicalKey: 'expenses', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'supplier', type: 'relation' }, { id: 'receiptUrl', type: 'text' }] }],
        ['db-suppliers', { id: 'db-suppliers', logicalKey: 'suppliers', properties: [{ id: 'title', type: 'title' }, { id: 'vat', type: 'text' }, { id: 'address', type: 'text' }] }],
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
