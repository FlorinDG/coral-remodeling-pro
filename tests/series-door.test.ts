import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRecord } from '../src/lib/data/records.ts';
import { proformaSeries } from '../src/lib/records/series.ts';

/** A scoped-client stand-in with the one query the series needs (title starts with the prefix). */
function fakeDb() {
    const pages = new Map<string, Record<string, any>>();
    let clock = 1;
    const client: any = {
        globalPage: {
            findFirst: async ({ where }: any) => pages.get(where.id) ?? null,
            findMany: async ({ where }: any) => [...pages.values()].filter(p =>
                p.databaseId === where.databaseId && String(p.properties?.title ?? '').startsWith(where.properties.string_starts_with)),
            create: async ({ data }: any) => { const row = { ...data, updatedAt: new Date(++clock * 1000), blocksVersion: 1 }; pages.set(data.id, row); return row; },
        },
        globalDatabase: { findFirst: async ({ where }: any) => (where.id === 'db-inv' ? { id: 'db-inv' } : null) },
        $transaction: async (fn: any) => fn(client),
    };
    return { client, pages };
}

const create = (db: any, id: string) => saveRecord(db, { pageId: id, fields: {} }, {
    by: 'u1',
    createIfMissing: { databaseId: 'db-inv', properties: { docType: 'opt-proforma', status: 'opt-draft' }, createdBy: 'u1', series: proformaSeries('2026') },
});

test('the door numbers a new proforma in its series, inside its transaction (throw proof: every proforma titled "Proforma")', async () => {
    const { client, pages } = fakeDb();
    const a = await create(client, 'p1');
    const b = await create(client, 'p2');
    assert.ok(a.ok && b.ok);
    assert.equal(pages.get('p1')!.properties.title, 'PF-2026-001');
    assert.equal(pages.get('p2')!.properties.title, 'PF-2026-002');
    assert.equal(pages.get('p2')!.properties.docType, 'opt-proforma');
});
