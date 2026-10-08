import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versionOf, versionChanged } from '../src/lib/records/database-version.ts';

const read = versionOf([{ updatedAt: '2026-10-08T08:00:00.000Z' }, { updatedAt: '2026-10-08T09:30:00.000Z' }]);

test('a version is the count and the newest change', () => {
    assert.deepEqual(read, { count: 2, lastUpdatedAt: '2026-10-08T09:30:00.000Z' });
    assert.deepEqual(versionOf([]), { count: 0, lastUpdatedAt: null });
});

test('Florin 2026-10-08: a receipt saved on the phone changes the version the desktop holds', () => {
    assert.equal(versionChanged(read, { count: 3, lastUpdatedAt: '2026-10-08T10:00:00.000Z' }), true);   // added
    assert.equal(versionChanged(read, { count: 2, lastUpdatedAt: '2026-10-08T10:00:00.000Z' }), true);   // edited
    assert.equal(versionChanged(read, { count: 1, lastUpdatedAt: '2026-10-08T09:30:00.000Z' }), true);   // deleted
    assert.equal(versionChanged(read, { ...read }), false);
    assert.equal(versionChanged(undefined, read), false);   // never read here
});
