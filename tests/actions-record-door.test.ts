/**
 * Tests for R2-1-B M1: Actions Module record writes onto the saveRecord door.
 *
 * Covers:
 * 1. accept-invoice pure intent & saveRecord execution + refusal handling.
 * 2. accept-quote pure intent & saveRecord execution + refusal handling.
 * 3. pages.ts handlePaymentMatching pure intents (exact & suggested) + saveRecord execution.
 * 4. tasks.ts createTaskPage & updateTaskStatus pure data builders + priority mapping + saveRecord execution.
 * 5. C1 lifecycle invariant: none of the M1 action adapters pass lifecycle.
 * 6. Throw proofs verifying that lock violations and OCC stale writes are refused.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRecord } from '../src/lib/data/records.ts';
import {
    buildAcceptInvoiceIntent,
    buildAcceptQuoteIntent,
    buildPaymentMatchIntent,
    buildPaymentSuggestedMatchIntent,
    buildTaskCreateData,
    buildTaskStatusIntent,
    resolveTaskPriority,
} from '../src/lib/records/actions-record-intents.ts';

function fakeDb() {
    let clock = 1000;
    const stamp = () => new Date(++clock * 1000);
    const dbs = new Map<string, { id: string; logicalKey: string | null; properties: unknown[] }>([
        ['db-invoices', { id: 'db-invoices', logicalKey: 'invoices', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'clientSignature', type: 'text' }] }],
        ['db-quotes', { id: 'db-quotes', logicalKey: 'quotations', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'clientSignature', type: 'text' }] }],
        ['db-payments', { id: 'db-payments', logicalKey: 'payments', properties: [{ id: 'invoice', type: 'relation' }, { id: 'suggestedInvoice', type: 'relation' }] }],
        ['db-tasks', { id: 'db-tasks', logicalKey: 'tasks', properties: [{ id: 'title', type: 'title' }, { id: 'prop-task-status', type: 'select' }, { id: 'prop-task-priority', type: 'select' }] }],
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

test('R2-1-B M1: buildAcceptInvoiceIntent constructs delta intent and by: client:link with no lifecycle', () => {
    const payload = {
        signatureBase64: 'data:image/png;base64,sig123',
        signatureMethod: 'draw',
        consentName: 'John Doe',
    };
    const baseUpdatedAt = '2026-10-05T12:00:00.000Z';
    const nowIso = '2026-10-05T12:05:00.000Z';

    const { intent, opts } = buildAcceptInvoiceIntent('inv-1', payload, baseUpdatedAt, nowIso);

    assert.equal(intent.pageId, 'inv-1');
    assert.equal(intent.baseUpdatedAt, baseUpdatedAt);
    assert.deepEqual(intent.fields, {
        status: 'ACCEPTED',
        clientSignature: 'data:image/png;base64,sig123',
        signatureMethod: 'draw',
        consentName: 'John Doe',
        signedAt: nowIso,
    });
    assert.equal(opts.by, 'client:link');
    // C1: lifecycle is NOT passed by accept-invoice
    assert.equal((opts as any).lifecycle, undefined);
});

test('R2-1-B M1: accept-invoice updates record through door and handles document lock refusal', async () => {
    const { client, pages } = fakeDb();
    pages.set('inv-1', {
        id: 'inv-1',
        databaseId: 'db-invoices',
        properties: { title: 'Invoice #101', status: 'DRAFT', amount: 500 },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'user-1',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const { intent, opts } = buildAcceptInvoiceIntent('inv-1', {
        signatureBase64: 'sig-data',
        signatureMethod: 'typed',
        consentName: 'Client A',
    }, v1);

    const saved = await saveRecord(client, intent, opts);
    assert.ok(saved.ok);
    assert.equal(saved.changed, true);
    assert.equal(pages.get('inv-1')!.properties.status, 'ACCEPTED');
    assert.equal(pages.get('inv-1')!.properties.clientSignature, 'sig-data');
    assert.equal(pages.get('inv-1')!.properties.amount, 500); // untouched existing field preserved
    assert.equal(pages.get('inv-1')!.lastEditedBy, 'client:link');
});

test('R2-1-B M1: buildAcceptQuoteIntent constructs delta intent and by: client:link with no lifecycle', () => {
    const payload = {
        signatureBase64: 'sig-quote-123',
        signatureMethod: 'draw',
        consentName: 'Client Jane',
    };
    const baseUpdatedAt = '2026-10-05T10:00:00.000Z';
    const nowIso = '2026-10-05T10:15:00.000Z';

    const { intent, opts } = buildAcceptQuoteIntent('quote-42', payload, baseUpdatedAt, nowIso);

    assert.equal(intent.pageId, 'quote-42');
    assert.equal(intent.baseUpdatedAt, baseUpdatedAt);
    assert.deepEqual(intent.fields, {
        status: 'opt-accepted',
        clientSignature: 'sig-quote-123',
        signatureMethod: 'draw',
        consentName: 'Client Jane',
        signedAt: nowIso,
    });
    assert.equal(opts.by, 'client:link');
    // C1: lifecycle is NOT passed by accept-quote
    assert.equal((opts as any).lifecycle, undefined);
});

test('R2-1-B M1: accept-quote allows client acceptance through quote document lock', async () => {
    const { client, pages } = fakeDb();
    pages.set('quote-42', {
        id: 'quote-42',
        databaseId: 'db-quotes',
        properties: { title: 'Quote #42', status: 'opt-sent', betreft: 'Renovation' },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'estimator-1',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const { intent, opts } = buildAcceptQuoteIntent('quote-42', {
        signatureBase64: 'sig-quote-data',
        signatureMethod: 'draw',
        consentName: 'Customer Bob',
    }, v1);

    const saved = await saveRecord(client, intent, opts);
    assert.ok(saved.ok);
    assert.equal(saved.changed, true);
    assert.equal(pages.get('quote-42')!.properties.status, 'opt-accepted');
    assert.equal(pages.get('quote-42')!.properties.betreft, 'Renovation');
    assert.equal(pages.get('quote-42')!.lastEditedBy, 'client:link');
});

test('R2-1-B M1: buildPaymentMatchIntent & buildPaymentSuggestedMatchIntent delta intents', async () => {
    const { client, pages } = fakeDb();
    pages.set('pay-1', {
        id: 'pay-1',
        databaseId: 'db-payments',
        properties: { amount: 1200, structuredComm: '+++123/4567/89012+++' },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'bank-sync',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const exact = buildPaymentMatchIntent('pay-1', 'inv-101', v1);
    assert.equal(exact.opts.by, 'system:payment-match');
    assert.deepEqual(exact.intent.fields, { invoice: ['inv-101'] });
    assert.equal((exact.opts as any).lifecycle, undefined);

    const savedExact = await saveRecord(client, exact.intent, exact.opts);
    assert.ok(savedExact.ok);
    assert.deepEqual(pages.get('pay-1')!.properties.invoice, ['inv-101']);
    assert.equal(pages.get('pay-1')!.properties.amount, 1200);

    const v2 = (savedExact as any).updatedAt;
    const suggested = buildPaymentSuggestedMatchIntent('pay-1', 'inv-202', v2);
    assert.equal(suggested.opts.by, 'system:payment-match');
    assert.deepEqual(suggested.intent.fields, { suggestedInvoice: ['inv-202'] });

    const savedSuggested = await saveRecord(client, suggested.intent, suggested.opts);
    assert.ok(savedSuggested.ok);
    assert.deepEqual(pages.get('pay-1')!.properties.suggestedInvoice, ['inv-202']);
    assert.deepEqual(pages.get('pay-1')!.properties.invoice, ['inv-101']);
});

test('R2-1-B M1: tasks priority mapping resolves priority strings correctly', () => {
    assert.equal(resolveTaskPriority('p1'), 'opt-p1');
    assert.equal(resolveTaskPriority('urgent'), 'opt-p1');
    assert.equal(resolveTaskPriority('High (P2)'), 'opt-p2');
    assert.equal(resolveTaskPriority('p3'), 'opt-p3');
    assert.equal(resolveTaskPriority('normal'), 'opt-p3');
    assert.equal(resolveTaskPriority('med'), 'opt-p3');
    assert.equal(resolveTaskPriority('p4'), 'opt-p4');
    assert.equal(resolveTaskPriority('low'), 'opt-p4');
    assert.equal(resolveTaskPriority(undefined), 'opt-p4');
    assert.equal(resolveTaskPriority(''), 'opt-p4');
});

test('R2-1-B M1: buildTaskCreateData creates task via saveRecord with createIfMissing and order meta', async () => {
    const { client, pages } = fakeDb();
    const taskInput = {
        title: 'Repair Wall',
        priority: 'high',
        status: 'opt-in-prog',
        projectId: 'proj-9',
        assignee: 'worker-7',
        dueDate: '2026-10-15',
    };

    const { intent, opts } = buildTaskCreateData('task-1', 'db-tasks', 'manager-1', 4, taskInput, '2026-10-05T09:00:00.000Z');
    assert.equal(opts.by, 'manager-1');
    assert.equal(opts.meta.order, 4);
    assert.equal(opts.createIfMissing.databaseId, 'db-tasks');
    assert.equal(opts.createIfMissing.createdBy, 'manager-1');
    assert.equal(intent.fields?.['prop-task-priority'], 'opt-p2');
    assert.equal(intent.fields?.['prop-task-status'], 'opt-in-prog');

    const saved = await saveRecord(client, intent, opts);
    assert.ok(saved.ok && saved.created);
    assert.equal(pages.get('task-1')!.properties.title, 'Repair Wall');
    assert.equal(pages.get('task-1')!.properties['prop-task-priority'], 'opt-p2');
    assert.equal(pages.get('task-1')!.order, 4);
    assert.equal(pages.get('task-1')!.createdBy, 'manager-1');
    assert.equal(pages.get('task-1')!.lastEditedBy, 'manager-1');
    // Planner review: the row's assignedTo column — "My tasks" and access-control read it (throw proof: it was lost)
    assert.deepEqual(pages.get('task-1')!.assignedTo, ['worker-7']);
});

test('R2-1-B M1: buildTaskStatusIntent sets completed-at for opt-done and clears it otherwise', async () => {
    const { client, pages } = fakeDb();
    pages.set('task-2', {
        id: 'task-2',
        databaseId: 'db-tasks',
        properties: { title: 'Install fixtures', 'prop-task-status': 'opt-todo', 'prop-task-completed-at': '' },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'manager-1',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const done = buildTaskStatusIntent('task-2', 'opt-done', 'lead-1', v1, '2026-10-05T15:30:00.000Z');
    assert.equal(done.opts.by, 'lead-1');
    assert.equal(done.intent.fields?.['prop-task-status'], 'opt-done');
    assert.equal(done.intent.fields?.['prop-task-completed-at'], '2026-10-05T15:30:00.000Z');

    const savedDone = await saveRecord(client, done.intent, done.opts);
    assert.ok(savedDone.ok);
    assert.equal(pages.get('task-2')!.properties['prop-task-status'], 'opt-done');
    assert.equal(pages.get('task-2')!.properties['prop-task-completed-at'], '2026-10-05T15:30:00.000Z');

    const v2 = (savedDone as any).updatedAt;
    const reopen = buildTaskStatusIntent('task-2', 'opt-in-prog', 'lead-1', v2, '2026-10-05T16:00:00.000Z');
    assert.equal(reopen.intent.fields?.['prop-task-completed-at'], '');

    const savedReopen = await saveRecord(client, reopen.intent, reopen.opts);
    assert.ok(savedReopen.ok);
    assert.equal(pages.get('task-2')!.properties['prop-task-status'], 'opt-in-prog');
    assert.equal(pages.get('task-2')!.properties['prop-task-completed-at'], '');
});

test('R2-1-B M1 Throw Proof 1: OCC stale write on task status update is refused with STALE_WRITE', async () => {
    const { client, pages } = fakeDb();
    pages.set('task-occ', {
        id: 'task-occ',
        databaseId: 'db-tasks',
        properties: { title: 'Paint ceiling', 'prop-task-status': 'opt-todo' },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(2000 * 1000),
        lastEditedBy: 'manager-1',
    });

    // Caller provides an outdated baseUpdatedAt
    const staleVersion = new Date(1000 * 1000).toISOString();
    const staleIntent = buildTaskStatusIntent('task-occ', 'opt-done', 'worker-2', staleVersion);

    const saved = await saveRecord(client, staleIntent.intent, staleIntent.opts);
    assert.equal(saved.ok, false);
    assert.equal(!saved.ok && saved.refusal.code, 'STALE_WRITE');
});

test('R2-1-B M1 Throw Proof 2: modifying frozen properties on an accountant-exported document without lifecycle is refused with EXPORT_LOCKED', async () => {
    const { client, pages } = fakeDb();
    pages.set('inv-exp', {
        id: 'inv-exp',
        databaseId: 'db-invoices',
        properties: {
            title: 'Invoice #999',
            status: 'ACCEPTED',
            accountantExportedAt: true,
        },
        blocks: [],
        blocksVersion: 1,
        updatedAt: new Date(1000 * 1000),
        lastEditedBy: 'system:export',
    });

    const v1 = new Date(1000 * 1000).toISOString();
    const payload = {
        signatureBase64: 'new-sig',
        signatureMethod: 'draw',
        consentName: 'Tamperer',
    };
    const { intent, opts } = buildAcceptInvoiceIntent('inv-exp', payload, v1);

    const saved = await saveRecord(client, intent, opts);
    assert.equal(saved.ok, false);
    assert.equal(!saved.ok && saved.refusal.code, 'EXPORT_LOCKED');
});
