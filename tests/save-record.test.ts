import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRecord } from '../src/lib/data/records.ts';

/** An in-memory stand-in for the scoped client: one tenant's databases and pages, a $transaction that runs inline. */
function fakeDb() {
    let clock = 1000;
    const stamp = () => new Date(++clock * 1000);
    const dbs = new Map<string, { id: string; logicalKey: string | null; properties: unknown[] }>([
        ['db-q', { id: 'db-q', logicalKey: 'quotations', properties: [{ id: 'title', type: 'text', name: 'Titel' }, { id: 'status', type: 'select' }, { id: 'calc', type: 'formula' }] }],
    ]);
    const pages = new Map<string, Record<string, any>>();
    const writes: string[] = [];
    const client = {
        globalPage: {
            findFirst: async ({ where }: any) => {
                const p = pages.get(where.id); if (!p) return null;
                return { ...p, database: { logicalKey: dbs.get(p.databaseId)!.logicalKey, properties: dbs.get(p.databaseId)!.properties } };
            },
            create: async ({ data }: any) => { const row = { ...data, updatedAt: stamp() }; pages.set(data.id, row); writes.push(`create ${data.id}`); return row; },
            update: async ({ where, data }: any) => { const row = { ...pages.get(where.id)!, ...data, updatedAt: stamp() }; pages.set(where.id, row); writes.push(`update ${where.id}`); return row; },
        },
        globalDatabase: { findFirst: async ({ where }: any) => dbs.get(where.id) ? { id: where.id } : null },
        $transaction: async (fn: any) => fn(client),
    };
    return { client: client as any, pages, writes };
}

test('a browser-minted page is created in a database of THIS tenant; an unknown database refuses', async () => {
    const { client } = fakeDb();
    const ok = await saveRecord(client, { pageId: 'p1', fields: { title: 'Q-1' } }, { by: 'u1', createIfMissing: { databaseId: 'db-q', properties: { title: 'Q-1' }, createdBy: 'u1' } });
    assert.ok(ok.ok && ok.created);
    const no = await saveRecord(client, { pageId: 'p2', fields: { title: 'x' } }, { by: 'u1', createIfMissing: { databaseId: 'db-other-tenant', properties: {}, createdBy: 'u1' } });
    assert.equal(!no.ok && no.refusal.code, 'NOT_FOUND');
});

test('returns the PERSISTED updatedAt; an unchanged save writes nothing and bumps nothing (throw proof: meta always written)', async () => {
    const { client, writes } = fakeDb();
    const c = await saveRecord(client, { pageId: 'p1', fields: {} }, { by: 'u1', createIfMissing: { databaseId: 'db-q', properties: { title: 'A', status: 'draft' }, createdBy: 'u1' } });
    assert.ok(c.ok);
    const before = writes.length;
    const same = await saveRecord(client, { pageId: 'p1', fields: { title: 'A' }, baseUpdatedAt: c.ok ? c.updatedAt : null }, { by: 'u1', meta: { icon: null, order: null } });
    assert.ok(same.ok && !same.changed);
    assert.equal(writes.length, before);
    assert.equal(same.ok && same.updatedAt, c.ok && c.updatedAt);
    const ch = await saveRecord(client, { pageId: 'p1', fields: { title: 'B' }, baseUpdatedAt: c.ok ? c.updatedAt : null }, { by: 'u1' });
    assert.ok(ch.ok && ch.changed && ch.updatedAt !== (c.ok && c.updatedAt));
});

test('two saves from the same old version on DIFFERENT fields both land; computed fields never written', async () => {
    const { client, pages } = fakeDb();
    const c = await saveRecord(client, { pageId: 'p1' }, { by: 'u1', createIfMissing: { databaseId: 'db-q', properties: { title: 'A', status: 'draft' }, createdBy: 'u1' } });
    const v1 = c.ok ? c.updatedAt : '';
    await saveRecord(client, { pageId: 'p1', fields: { title: 'B' }, base: { title: 'A' }, baseUpdatedAt: v1 }, { by: 'u1' });
    const second = await saveRecord(client, { pageId: 'p1', fields: { status: 'opt-draft2', calc: 7 }, base: { status: 'draft' }, baseUpdatedAt: v1 }, { by: 'u2' });
    assert.ok(second.ok);
    assert.deepEqual(second.ok && second.ignored, ['calc']);
    assert.equal(pages.get('p1')!.properties.title, 'B');
    assert.equal(pages.get('p1')!.properties.status, 'opt-draft2');
    assert.equal(pages.get('p1')!.properties.calc, undefined);
});

test('a refusal hands back the server row (the store reverts to it) — sent quote is locked', async () => {
    const { client } = fakeDb();
    await saveRecord(client, { pageId: 'p1' }, { by: 'u1', createIfMissing: { databaseId: 'db-q', properties: { title: 'Q', status: 'opt-sent' }, createdBy: 'u1' } });
    const r = await saveRecord(client, { pageId: 'p1', fields: { title: 'changed' } }, { by: 'u1' });
    assert.equal(!r.ok && r.refusal.code, 'DOCUMENT_LOCKED');
    assert.equal(!r.ok && r.server?.properties.title, 'Q');
    assert.equal(!r.ok && r.logicalKey, 'quotations');
});
