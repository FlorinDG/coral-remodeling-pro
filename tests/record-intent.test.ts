import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRecordIntent, changedFields } from '../src/lib/records/record-intent.ts';

const ctx = { dbProperties: [
    { id: 'title', type: 'text' }, { id: 'status', type: 'select' }, { id: 'date', type: 'date' },
    { id: 'client', type: 'relation' }, { id: 'calc', type: 'formula' }, { id: 'comments', type: 'comments' },
] };
const row = (over: Partial<{ properties: Record<string, unknown>; blocks: unknown; blocksVersion: number; updatedAt: string }> = {}) => ({
    properties: { title: 'A', status: 'open', date: '2026-10-01' }, blocks: [{ id: 'b1' }], blocksVersion: 3, updatedAt: 'T1', ...over,
});

test('only changed fields travel', () => {
    assert.deepEqual(changedFields({ title: 'A', status: 'done', x: 1 }, { title: 'A', status: 'open' }), ['status', 'x']);
    assert.deepEqual(changedFields({ a: 1 }, null), ['a']);
});

test('N1 by construction: two people, DIFFERENT fields, same old version — both land, no conflict', () => {
    const server = row();
    const a = applyRecordIntent(server, { pageId: 'p', fields: { title: 'B' }, base: { title: 'A' }, baseUpdatedAt: 'T1' }, ctx);
    assert.ok(a.ok);
    const after = row({ properties: a.ok ? a.properties : {}, updatedAt: 'T2' });
    const b = applyRecordIntent(after, { pageId: 'p', fields: { date: '2026-10-05' }, base: { date: '2026-10-01' }, baseUpdatedAt: 'T1' }, ctx);
    assert.ok(b.ok);
    assert.deepEqual(b.ok && b.properties, { title: 'B', status: 'open', date: '2026-10-05' });
});

test('the SAME field changed differently since the client\'s version → STALE_WRITE (throw proof: no merge = silent stomp)', () => {
    const server = row({ properties: { title: 'Server', status: 'open' }, updatedAt: 'T2' });
    const r = applyRecordIntent(server, { pageId: 'p', fields: { title: 'Mine' }, base: { title: 'A' }, baseUpdatedAt: 'T1' }, ctx);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.refusal.code, 'STALE_WRITE');
});

test('computed fields are never written by a client — ignored and reported', () => {
    const r = applyRecordIntent(row(), { pageId: 'p', fields: { calc: 99, comments: 'x', status: 'done' } }, ctx);
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.ignored.sort(), ['calc', 'comments']);
    assert.equal(r.ok && (r.properties as Record<string, unknown>).calc, undefined);
    assert.equal(r.ok && (r.properties as Record<string, unknown>).status, 'done');
});

test('blocks: versioned, never an empty tree over existing lines; unchanged = no write', () => {
    assert.equal((applyRecordIntent(row(), { pageId: 'p', blocks: [] }, ctx) as { refusal: { code: string } }).refusal.code, 'EMPTY_BLOCKS_PROTECTION');
    assert.equal((applyRecordIntent(row(), { pageId: 'p', blocks: [{ id: 'b2' }], baseBlocksVersion: 2 }, ctx) as { refusal: { code: string } }).refusal.code, 'STALE_WRITE');
    const ok = applyRecordIntent(row(), { pageId: 'p', blocks: [{ id: 'b2' }], baseBlocksVersion: 3 }, ctx);
    assert.ok(ok.ok && ok.changed && ok.blocksVersion === 4);
    const same = applyRecordIntent(row(), { pageId: 'p', fields: { title: 'A' } }, ctx);
    assert.ok(same.ok && !same.changed);
});

test('the accountant-export lock and the quote document lock hold at the one door', () => {
    const exported = row({ properties: { title: 'F-1', accountantExportedAt: true } });
    const r = applyRecordIntent(exported, { pageId: 'p', fields: { title: 'F-2' } }, ctx);
    assert.equal(!r.ok && r.refusal.code, 'EXPORT_LOCKED');
    const linkOk = applyRecordIntent(exported, { pageId: 'p', fields: { client: ['c1'] } }, ctx);
    assert.ok(linkOk.ok);                                            // linking stays allowed
    const sentQuote = row({ properties: { title: 'Q', status: 'opt-sent' } });
    const q = applyRecordIntent(sentQuote, { pageId: 'p', fields: { title: 'Q2' } }, { ...ctx, logicalKey: 'quotations' });
    assert.equal(!q.ok && q.refusal.code, 'DOCUMENT_LOCKED');
});
