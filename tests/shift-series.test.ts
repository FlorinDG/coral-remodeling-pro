import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScope, seriesData, seriesWhere } from '../src/lib/data/shift-series.ts';

const anchor = { id: 's3', seriesId: 'abc1234', shiftDate: '2026-10-08' };

test('scope: unknown or absent → occurrence', () => {
    assert.equal(parseScope(null), 'occurrence');
    assert.equal(parseScope('everything'), 'occurrence');
    assert.equal(parseScope('series'), 'series');
});

test('occurrence or no series → no other shift is touched', () => {
    assert.equal(seriesWhere('t1', anchor, 'occurrence'), null);
    assert.equal(seriesWhere('t1', { ...anchor, seriesId: null }, 'series'), null);
});

test('series: always tenant-scoped, never the anchor, never a submitted shift', () => {
    const w = seriesWhere('t1', anchor, 'series') as Record<string, unknown>;
    assert.equal(w.tenantId, 't1');
    assert.equal(w.seriesId, 'abc1234');
    assert.deepEqual(w.id, { not: 's3' });
    assert.deepEqual(w.status, { notIn: ['completed', 'Completed'] });
    assert.equal('shiftDate' in w, false);
});

test('following: from the anchor date on', () => {
    const w = seriesWhere('t1', anchor, 'following') as Record<string, unknown>;
    assert.deepEqual(w.shiftDate, { gte: '2026-10-08' });
});

test('series fields: date, worker, status, crew note never copied', () => {
    const d = seriesData({ shiftDate: '2026-10-09', userId: 'u2', status: 'completed', crewNote: 'x', seriesId: 'zz',
        shiftStart: '07:00', projectId: 'p1', siteAddress: 'Rue X 1', materialsEnabled: true });
    assert.deepEqual(d, { shiftStart: '07:00', projectId: 'p1', siteAddress: 'Rue X 1', materialsEnabled: true });
});
