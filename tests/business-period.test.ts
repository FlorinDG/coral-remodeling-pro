import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessPeriod, periodQueryWindow, inBusinessPeriod } from '../src/lib/records/business-period.ts';

const october = businessPeriod('2026-10-01', '2026-10-31');

test('the last day of the period counts — all of it', () => {
    // 31 Oct 15:00 Brussels (CET, after the clock change) = 14:00Z. `lte new Date("2026-10-31")` dropped it.
    assert.equal(inBusinessPeriod('2026-10-31T14:00:00Z', october), true);
    const w = periodQueryWindow(october)!;
    assert.ok(new Date('2026-10-31T14:00:00Z') < w.lt!);
});

test('Brussels just after midnight on the first day counts; the evening before does not', () => {
    // 1 Oct 00:30 Brussels (CEST) = 30 Sep 22:30Z — a UTC reading put it in September.
    assert.equal(inBusinessPeriod('2026-09-30T22:30:00Z', october), true);
    assert.ok(new Date('2026-09-30T22:30:00Z') >= periodQueryWindow(october)!.gte!);
    // 30 Sep 23:30 Brussels = 21:30Z — September.
    assert.equal(inBusinessPeriod('2026-09-30T21:30:00Z', october), false);
});

test('1 Nov 00:30 Brussels is November, though it is still 31 Oct in UTC', () => {
    assert.equal(inBusinessPeriod('2026-10-31T23:30:00Z', october), false);
});

test('no bounds, or garbage bounds, mean the whole history', () => {
    assert.equal(periodQueryWindow(businessPeriod(null, null)), null);
    assert.deepEqual(businessPeriod('31/10/2026', 'x'), { from: null, to: null });
    assert.equal(inBusinessPeriod('2020-01-01T10:00:00Z', businessPeriod(null, null)), true);
});
