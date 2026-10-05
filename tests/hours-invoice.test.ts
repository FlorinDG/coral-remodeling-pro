import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefillParties, hoursPerWorkerDay } from '../src/lib/records/hours-invoice.ts';

const clientOf = (p: string) => ({ p1: 'c1', p2: 'c1', p3: 'c2', p4: '' } as Record<string, string>)[p];

test('prefill only when the hours point at exactly one — otherwise left to the editor, never refused', () => {
    assert.deepEqual(prefillParties([{ projectId: 'p1' }, { projectId: 'p1' }], clientOf), { clientId: 'c1', projectId: 'p1' });
    assert.deepEqual(prefillParties([{ projectId: 'p1' }, { projectId: 'p2' }], clientOf), { clientId: 'c1', projectId: null });
    assert.deepEqual(prefillParties([{ projectId: 'p1' }, { projectId: 'p3' }], clientOf), { clientId: null, projectId: null });
    assert.deepEqual(prefillParties([{ projectId: 'p1' }, { projectId: null }], clientOf), { clientId: null, projectId: null });
    assert.deepEqual(prefillParties([{ projectId: 'p4' }], clientOf), { clientId: null, projectId: 'p4' });
    assert.deepEqual(prefillParties([], clientOf), { clientId: null, projectId: null });
});

test('one line per worker per day, summed, sorted by date then name', () => {
    const lines = hoursPerWorkerDay([
        { userId: 'b', projectId: null, date: '2026-10-02', minutes: 60 },
        { userId: 'a', projectId: null, date: '2026-10-02', minutes: 30 },
        { userId: 'a', projectId: null, date: '2026-10-01', minutes: 90 },
        { userId: 'a', projectId: null, date: '2026-10-02', minutes: 45 },
    ], u => ({ a: 'Ann', b: 'Bob' } as Record<string, string>)[u]);
    assert.deepEqual(lines.map(l => `${l.date} ${l.name} ${l.minutes}`), ['2026-10-01 Ann 90', '2026-10-02 Ann 75', '2026-10-02 Bob 60']);
});
