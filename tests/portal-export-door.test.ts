/**
 * R2-1-B Milestone 4 Characterization Tests: Portal & Accountant Export routes onto saveRecord door.
 *
 * Verifies:
 * - Proper delta intent and options construction for accountant export stamp.
 * - Proper intent and options for portal project creation and portal task creation/update.
 * - C1: NO lifecycle on any of these writers (lifecycle is strictly for cron-overdue and invoice-payments).
 * - Row columns preserved: assignedTo: [] on new records, createdBy, lastEditedBy.
 * - Stamping accountant-exported records succeeds through saveRecord.
 * - Error/refusal handling through saveRecord.
 * - Throw proofs for accountant export stamp and portal task delta intent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    buildAccountantExportStampIntent,
    buildPortalProjectCreateData,
    buildPortalTaskCreateData,
    buildPortalTaskUpdateIntent,
} from '../src/lib/records/portal-export-intents.ts';
import { saveRecord } from '../src/lib/data/records.ts';
import type { TenantScopedClient } from '../src/lib/data/scope.ts';

function fakeDb() {
    const dbs = new Map<string, { id: string; logicalKey: string | null; properties: unknown[] }>([
        ['db-invoices', { id: 'db-invoices', logicalKey: 'invoices', properties: [{ id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'accountantExportedAt', type: 'checkbox' }] }],
        ['db-projects', { id: 'db-projects', logicalKey: 'projects', properties: [{ id: 'title', type: 'title' }, { id: 'clientName', type: 'text' }, { id: 'status', type: 'select' }, { id: 'budget', type: 'number' }] }],
        ['db-tasks', { id: 'db-tasks', logicalKey: 'tasks', properties: [{ id: 'title', type: 'title' }, { id: 'prop-task-status', type: 'select' }, { id: 'prop-task-due', type: 'date' }, { id: 'prop-task-file-url', type: 'text' }, { id: 'prop-task-portal', type: 'relation' }] }],
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
                    updatedAt: new Date('2026-10-09T08:00:00Z'),
                    createdAt: new Date('2026-10-09T08:00:00Z'),
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
                    updatedAt: new Date('2026-10-09T08:05:00Z'),
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

// ── 1. Accountant Export Intent & Door Tests ─────────────────────────────────

test('R2-1-B M4: buildAccountantExportStampIntent constructs delta fields with actor metadata and opts.by', () => {
    const { intent, opts } = buildAccountantExportStampIntent('inv-123', {
        identifier: 'Jan Accountant (jan@example.com)',
        userId: 'usr-jan',
        email: 'jan@example.com',
        timestamp: '2026-10-09T08:00:00Z',
    });

    assert.equal(intent.pageId, 'inv-123');
    assert.deepEqual(intent.fields, {
        accountantExportedAt: true,
        accountantExportedBy: 'Jan Accountant (jan@example.com)',
        accountantExportedById: 'usr-jan',
        accountantExportedTimestamp: '2026-10-09T08:00:00Z',
    });
    assert.equal(opts.by, 'jan@example.com');
});

test('R2-1-B M4: stamping accountant-exported record succeeds through saveRecord door', async () => {
    const { client, pages } = fakeDb();
    pages.set('inv-456', {
        id: 'inv-456',
        databaseId: 'db-invoices',
        properties: { title: 'Factuur 2026-001', status: 'opt-sent' },
        updatedAt: new Date('2026-10-09T07:00:00Z'),
        lastEditedBy: 'system',
    });

    const { intent, opts } = buildAccountantExportStampIntent('inv-456', {
        identifier: 'System (export)',
        userId: 'system',
        timestamp: '2026-10-09T08:00:00Z',
    });

    const res = await saveRecord(client, intent, opts);
    assert.equal(res.ok, true);
    if (!res.ok) return;

    assert.equal(res.properties.accountantExportedAt, true);
    assert.equal(res.properties.accountantExportedBy, 'System (export)');
    assert.equal(res.properties.title, 'Factuur 2026-001');
    assert.equal(res.properties.status, 'opt-sent');
});

// ── 2. Portal Project Creation Tests ─────────────────────────────────────────

test('R2-1-B M4: buildPortalProjectCreateData builds intent and createIfMissing with assignedTo: []', async () => {
    const { intent, opts } = buildPortalProjectCreateData({
        pageId: 'proj-new-1',
        databaseId: 'db-projects',
        projectTitle: 'Villa Verbouwing',
        clientName: 'Familie Peeters',
        budget: 50000,
        userId: 'usr-admin-1',
    });

    assert.equal(intent.pageId, 'proj-new-1');
    assert.equal(opts.by, 'usr-admin-1');
    assert.deepEqual(opts.createIfMissing.assignedTo, []);
    assert.equal(opts.createIfMissing.createdBy, 'usr-admin-1');
    assert.equal(opts.createIfMissing.databaseId, 'db-projects');
    assert.equal(opts.createIfMissing.properties.title, 'Villa Verbouwing');
    assert.equal(opts.createIfMissing.properties.clientName, 'Familie Peeters');
    assert.equal(opts.createIfMissing.properties.budget, 50000);

    const { client } = fakeDb();
    const res = await saveRecord(client, intent, opts);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.created, true);
    assert.equal(res.properties.title, 'Villa Verbouwing');
    assert.equal(res.properties.clientName, 'Familie Peeters');
});

// ── 3. Portal Task Creation & Update Tests ───────────────────────────────────

test('R2-1-B M4: buildPortalTaskCreateData builds task intent with by: portal:client', async () => {
    const { intent, opts } = buildPortalTaskCreateData({
        pageId: 'task-new-1',
        databaseId: 'db-tasks',
        portalId: 'portal-client-99',
        title: 'Vergunning aanvragen',
        dueDate: '2026-11-01T00:00:00Z',
        fileUrl: 'https://storage.coral.io/doc.pdf',
    });

    assert.equal(intent.pageId, 'task-new-1');
    assert.equal(opts.by, 'portal:client');
    assert.deepEqual(opts.createIfMissing.assignedTo, []);
    assert.equal(opts.createIfMissing.createdBy, 'system:portal');
    assert.equal(opts.createIfMissing.properties.title, 'Vergunning aanvragen');
    assert.equal(opts.createIfMissing.properties['prop-task-status'], 'opt-todo');
    assert.deepEqual(opts.createIfMissing.properties['prop-task-portal'], ['portal-client-99']);

    const { client } = fakeDb();
    const res = await saveRecord(client, intent, opts);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.created, true);
    assert.equal(res.properties.title, 'Vergunning aanvragen');
});

test('R2-1-B M4: buildPortalTaskUpdateIntent sends strictly delta fields', async () => {
    const { intent, opts } = buildPortalTaskUpdateIntent({
        pageId: 'task-existing-1',
        status: 'DONE',
    });

    assert.equal(intent.pageId, 'task-existing-1');
    assert.deepEqual(intent.fields, { 'prop-task-status': 'opt-done' });
    assert.equal(opts.by, 'portal:client');

    const { client, pages } = fakeDb();
    pages.set('task-existing-1', {
        id: 'task-existing-1',
        databaseId: 'db-tasks',
        properties: {
            title: 'Dakpannen controleren',
            'prop-task-status': 'opt-todo',
            'prop-task-portal': ['portal-client-99'],
        },
        updatedAt: new Date('2026-10-09T07:00:00Z'),
        lastEditedBy: 'system:portal',
    });

    const res = await saveRecord(client, intent, opts);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.changed, true);
    assert.equal(res.properties['prop-task-status'], 'opt-done');
    assert.equal(res.properties.title, 'Dakpannen controleren'); // Preserved from server
});

test('R2-1-B M4: updating a non-existent task yields NOT_FOUND refusal', async () => {
    const { client } = fakeDb();
    const { intent, opts } = buildPortalTaskUpdateIntent({
        pageId: 'task-missing-404',
        title: 'Nieuwe titel',
    });

    const res = await saveRecord(client, intent, opts);
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.refusal.code, 'NOT_FOUND');
});

test('REVIEW-FIX-1 B1: no file under src/lib/records/ imports from lib/data', () => {
    const dir = path.resolve('src/lib/records');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
    const violating: string[] = [];
    for (const f of files) {
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        if (content.includes("from '@/lib/data") || content.includes("from '../data")) {
            violating.push(f);
        }
    }
    assert.deepEqual(violating, [], `Files in src/lib/records importing from lib/data: ${violating.join(', ')}`);
});

test('REVIEW-FIX-1 B2: a due date is normalised to Brussels calendar day YYYY-MM-DD', () => {
    // Plain calendar day remains unchanged
    const plain = buildPortalTaskCreateData({
        pageId: 'task-1',
        databaseId: 'db-tasks',
        portalId: 'portal-1',
        title: 'Task 1',
        dueDate: '2026-10-10',
    });
    assert.equal(plain.intent.fields?.['prop-task-due'], '2026-10-10');

    // ISO instant near midnight UTC resolves to Brussels business day (Oct 10, not Oct 9)
    const iso = buildPortalTaskCreateData({
        pageId: 'task-2',
        databaseId: 'db-tasks',
        portalId: 'portal-1',
        title: 'Task 2',
        dueDate: '2026-10-09T23:30:00.000Z',
    });
    assert.equal(iso.intent.fields?.['prop-task-due'], '2026-10-10');

    // Empty stays empty
    const empty = buildPortalTaskCreateData({
        pageId: 'task-3',
        databaseId: 'db-tasks',
        portalId: 'portal-1',
        title: 'Task 3',
        dueDate: '',
    });
    assert.equal(empty.intent.fields?.['prop-task-due'], '');

    // Same behavior on task update
    const updateIso = buildPortalTaskUpdateIntent({
        pageId: 'task-2',
        dueDate: '2026-10-09T23:30:00.000Z',
    });
    assert.equal(updateIso.intent.fields?.['prop-task-due'], '2026-10-10');
});

