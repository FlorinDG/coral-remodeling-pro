import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseDateValue, formatDisplayDate } from '../src/lib/records/date-cell.ts';

test('a stored date is a calendar day; older shapes read as the day they mean', () => {
    assert.equal(normaliseDateValue('2026-10-05'), '2026-10-05');
    assert.equal(normaliseDateValue('2026-10-05 🔔'), '2026-10-05 🔔');
    assert.equal(normaliseDateValue('5/10/2026'), '2026-10-05');
    assert.equal(normaliseDateValue('05.10.2026 🔔'), '2026-10-05 🔔');
    assert.equal(normaliseDateValue('not a date'), 'not a date');
});

test('an ISO instant is its BRUSSELS day, on any machine (throw proof: the old browser-zone reading under TZ=UTC)', () => {
    // 23:30 UTC on the 20th is already the 21st in Brussels
    assert.equal(normaliseDateValue('2026-02-20T23:30:00.000Z'), '2026-02-21');
    assert.equal(normaliseDateValue('2026-07-01T22:15:00.000Z'), '2026-07-02');
});

test('shown as "5 Oct 2026", the bell kept', () => {
    assert.equal(formatDisplayDate('2026-10-05'), '5 Oct 2026');
    assert.equal(formatDisplayDate('2026-01-31 🔔'), '31 Jan 2026 🔔');
    assert.equal(formatDisplayDate('garbage'), 'garbage');
});
