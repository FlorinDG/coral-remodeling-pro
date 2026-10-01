/**
 * OCC-MERGE-1 · the stale-write merge — tested against the REAL function both write doors call
 * (src/lib/records/occ-merge.ts), replacing the R2-5 tests that exercised a copy of the inline loop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStaleWrite, deepEqual } from '../src/lib/records/occ-merge.ts';

const base = { title: 'Offerte', client: ['c1'], notes: 'old', totalExVat: 100 };

test('another user changed a field I did not touch → their value is KEPT (was: stomped with mine)', () => {
    const server = { ...base, notes: 'B wrote this' };          // B saved notes
    const client = { ...base, title: 'Offerte v2' };            // A edited title on the old version
    const r = mergeStaleWrite(server, client, base);
    assert.equal(r.conflict, false);
    if (!r.conflict) {
        assert.equal(r.merged.title, 'Offerte v2');
        assert.equal(r.merged.notes, 'B wrote this');
        assert.deepEqual(r.tookServer, ['notes']);
    }
});

test('both changed the same field differently → conflict', () => {
    const r = mergeStaleWrite({ ...base, title: 'B' }, { ...base, title: 'A' }, base);
    assert.deepEqual(r, { conflict: true, key: 'title' });
});

test('both changed the same field to the same value → no conflict', () => {
    const r = mergeStaleWrite({ ...base, title: 'X' }, { ...base, title: 'X' }, base);
    assert.equal(r.conflict, false);
});

test('derived totals: both changed → the client\'s recomputation wins, no conflict', () => {
    const r = mergeStaleWrite({ ...base, totalExVat: 120 }, { ...base, totalExVat: 130 }, base);
    assert.equal(r.conflict, false);
    if (!r.conflict) assert.equal(r.merged.totalExVat, 130);
});

test('no base at all → any difference is a conflict (a client without a base is never silently merged)', () => {
    assert.equal(mergeStaleWrite({ ...base, notes: 'B' }, { ...base }, undefined).conflict, true);
    assert.equal(mergeStaleWrite({ ...base, notes: 'B' }, { ...base }, {}).conflict, true);
});

test('a field only the server has is kept; a new field only the client has is written', () => {
    const r = mergeStaleWrite({ ...base, extra: 1 }, { ...base, added: 'yes' }, base);
    assert.equal(r.conflict, false);
    if (!r.conflict) { assert.equal(r.merged.extra, 1); assert.equal(r.merged.added, 'yes'); }
});

test('deepEqual: arrays vs objects are never equal; nested order of keys does not matter', () => {
    assert.equal(deepEqual([], {}), false);
    assert.equal(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }), true);
});
