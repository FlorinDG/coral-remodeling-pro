/**
 * R2-1-B follow-up · saveRecords — several records in ONE transaction through the door: all saved, or none.
 * The accountant export stamps every exported document and writes their audit entries; a loop of saveRecord (M4)
 * left some documents stamped when one was refused.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRecords, saveRecord } from '../src/lib/data/records.ts';

/** The scoped client, in memory, with a $transaction that ROLLS BACK when its function throws. */
function fakeDb() {
    let clock = 1000;
    let pages = new Map<string, Record<string, any>>();
    let audit: string[] = [];
    const db = { id: 'db-inv', logicalKey: 'invoices', properties: [{ id: 'title', type: 'text' }] };
    const client: any = {
        globalPage: {
            findFirst: async ({ where }: any) => { const p = pages.get(where.id); return p ? { ...p, database: { logicalKey: db.logicalKey, properties: db.properties } } : null; },
            create: async ({ data }: any) => { const row = { ...data, updatedAt: new Date(++clock * 1000) }; pages.set(data.id, row); return row; },
            update: async ({ where, data }: any) => { const row = { ...pages.get(where.id)!, ...data, updatedAt: new Date(++clock * 1000) }; pages.set(where.id, row); return row; },
        },
        globalDatabase: { findFirst: async ({ where }: any) => (where.id === db.id ? { id: db.id } : null) },
        auditLog: { create: async ({ data }: any) => { audit.push(data.entityId); return data; } },
        $transaction: async (fn: any) => {
            const snapPages = new Map([...pages].map(([k, v]) => [k, { ...v, properties: { ...v.properties } }]));
            const snapAudit = [...audit];
            try { return await fn(client); } catch (e) { pages = snapPages; audit = snapAudit; throw e; }
        },
    };
    return { client, pages: () => pages, audit: () => audit };
}

const stamp = (id: string) => ({ intent: { pageId: id, fields: { accountantExportedAt: true } }, opts: { by: 'u1' } });

async function seed(client: any, ids: string[]) {
    for (const id of ids) await saveRecord(client, { pageId: id }, { by: 'u1', createIfMissing: { databaseId: 'db-inv', properties: { title: id }, createdBy: 'u1' } });
}

test('all saved, and `within` runs in the same transaction', async () => {
    const f = fakeDb();
    await seed(f.client, ['a', 'b', 'c']);
    const r = await saveRecords(f.client, ['a', 'b', 'c'].map(stamp), { within: async tx => { for (const id of ['a', 'b', 'c']) await tx.auditLog.create({ data: { entityId: id } }); } });
    assert.ok(r.ok);
    assert.deepEqual(['a', 'b', 'c'].map(id => f.pages().get(id)!.properties.accountantExportedAt), [true, true, true]);
    assert.deepEqual(f.audit(), ['a', 'b', 'c']);
});

test('one refused → NONE saved, no audit, and the refusal names the record', async () => {
    const f = fakeDb();
    await seed(f.client, ['a', 'c']);                       // 'b' does not exist → NOT_FOUND
    const r = await saveRecords(f.client, ['a', 'b', 'c'].map(stamp), { within: async tx => { await tx.auditLog.create({ data: { entityId: 'x' } }); } });
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.pageId, 'b');
    assert.equal(!r.ok && r.refusal.code, 'NOT_FOUND');
    assert.equal(f.pages().get('a')!.properties.accountantExportedAt, undefined);   // 'a' was rolled back
    assert.deepEqual(f.audit(), []);
});

test('the export uses the batch door — no loop of single saves', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/app/api/financials/export/route.ts', import.meta.url), 'utf8');
    assert.match(src, /saveRecords\(db,/);
    assert.doesNotMatch(src, /await saveRecord\(/);
});
