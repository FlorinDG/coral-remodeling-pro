import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickShiftNow, compareShifts, localDateKey, shiftTemporalState } from '../src/lib/kernel/shift-time.ts';

const day = '2026-09-30';
const morning = { id: 'am', shiftDate: day, shiftStart: '08:00', shiftEnd: '12:00' };
const afternoon = { id: 'pm', shiftDate: day, shiftStart: '13:00', shiftEnd: '17:00' };
const at = (h: number, m = 0) => new Date(2026, 8, 30, h, m);

test('the list is chronological within a day — creation order is irrelevant', () => {
    assert.deepEqual([afternoon, morning].sort(compareShifts).map(s => s.id), ['am', 'pm']);
});

test('Florin, 30 Sep: in the morning the morning shift is "now", not the later one', () => {
    // API order is createdAt desc — the afternoon shift came first; .find() returned it.
    assert.equal(pickShiftNow([afternoon, morning], at(7, 30))?.id, 'am');  // before both → next = morning
    assert.equal(pickShiftNow([afternoon, morning], at(9))?.id, 'am');      // running
    assert.equal(pickShiftNow([afternoon, morning], at(12, 30))?.id, 'pm'); // between → next
    assert.equal(pickShiftNow([afternoon, morning], at(14))?.id, 'pm');     // running
    assert.equal(pickShiftNow([afternoon, morning], at(18))?.id, 'pm');     // after all → last, clock back in
});

test('a completed shift can still be picked — status is ignored', () => {
    assert.equal(pickShiftNow([{ ...morning, status: 'completed' }], at(10))?.id, 'am');
});

test('no shift today → null (clock in without shift)', () => {
    assert.equal(pickShiftNow([{ ...morning, shiftDate: '2026-09-29' }], at(9)), null);
});

test('"today" is the LOCAL date, not UTC', () => {
    assert.equal(localDateKey(new Date(2026, 8, 30, 0, 30)), '2026-09-30'); // toISOString() would say the 29th in CEST
});

test('overnight shift', () => {
    const night = { shiftDate: day, shiftStart: '22:00', shiftEnd: '06:00' };
    assert.equal(shiftTemporalState(night, new Date(2026, 9, 1, 3, 0)), 'current');
});

test('a shift is submitted only when its status says so — both spellings in production', async () => {
    const { isShiftSubmitted } = await import('../src/lib/kernel/shift-time.ts');
    assert.equal(isShiftSubmitted('completed'), true);
    assert.equal(isShiftSubmitted('Completed'), true);      // legacy LateEntryForm rows
    assert.equal(isShiftSubmitted('in-progress'), false);   // clocked in, not submitted
    assert.equal(isShiftSubmitted('scheduled'), false);
    assert.equal(isShiftSubmitted(null), false);
});

test('server-side local time — Brussels wall clock from a UTC instant (DST both sides)', async () => {
    const { zonedParts } = await import('../src/lib/kernel/shift-time.ts');
    assert.deepEqual(zonedParts('2026-09-30T07:51:00Z'), { date: '2026-09-30', time: '09:51' }); // CEST, the HR-TS-6 case
    assert.deepEqual(zonedParts('2026-12-15T07:00:00Z'), { date: '2026-12-15', time: '08:00' }); // CET
    assert.deepEqual(zonedParts('2026-09-29T23:30:00Z'), { date: '2026-09-30', time: '01:30' }); // before 02:00 → the right day
    assert.deepEqual(zonedParts('2026-10-25T00:30:00Z'), { date: '2026-10-25', time: '02:30' }); // DST end night
});

test('SHIFT-LINK-1 — Florin\'s morning + afternoon shifts: map when unambiguous, rank otherwise', async () => {
    const { matchSpanToShifts, entrySpan } = await import('../src/lib/kernel/shift-time.ts');
    const am = { id: 'am', shiftDate: '2026-09-30', shiftStart: '08:00', shiftEnd: '12:00' };
    const pm = { id: 'pm', shiftDate: '2026-09-30', shiftStart: '13:00', shiftEnd: '17:00' };
    const day = [pm, am]; // creation order — must not matter
    assert.equal(matchSpanToShifts({ date: '2026-09-30', start: '08:05', end: '11:50' }, day).unique?.id, 'am');
    assert.equal(matchSpanToShifts({ date: '2026-09-30', start: '12:30', end: '16:00' }, day).unique?.id, 'pm');
    const both = matchSpanToShifts({ date: '2026-09-30', start: '10:00', end: '15:30' }, day);
    assert.equal(both.unique, null);                       // overlaps both → a suggestion, not a guess
    assert.equal(both.ranked[0].shift.id, 'pm');           // 150 min with pm vs 120 with am
    assert.equal(both.ranked.length, 2);                   // every shift of the day is offered
    const none = matchSpanToShifts({ date: '2026-09-30', start: '18:00', end: '19:00' }, day);
    assert.equal(none.unique, null); assert.equal(none.ranked[0].overlap, 0);
    // UTC instants of a CEST day → Brussels wall clock
    assert.deepEqual(entrySpan('2026-09-30T06:05:00Z', '2026-09-30T09:50:00Z'), { date: '2026-09-30', start: '08:05', end: '11:50' });
});

import { addDaysYmd, weekdayOfYmd, daysBetweenYmd } from '../src/lib/kernel/shift-time.ts';

test('calendar days are strings: adding days never slips across the clock change, month or leap year', () => {
    assert.equal(addDaysYmd('2026-03-28', 1), '2026-03-29');   // the night of the spring change
    assert.equal(addDaysYmd('2026-03-28', 2), '2026-03-30');
    assert.equal(addDaysYmd('2026-10-24', 7), '2026-10-31');   // across the autumn change
    assert.equal(addDaysYmd('2026-12-30', 3), '2027-01-02');
    assert.equal(addDaysYmd('2028-02-28', 1), '2028-02-29');
    assert.equal(addDaysYmd('2027-02-28', 1), '2027-03-01');
    assert.equal(addDaysYmd('2026-03-01', -1), '2026-02-28');
    assert.equal(addDaysYmd('2026-01-01', -1), '2025-12-31');
    assert.equal(addDaysYmd('2026-05-10', 0), '2026-05-10');
    assert.equal(addDaysYmd('2026-01-01', 365), '2027-01-01');
});

test('weekday and day distance without a Date', () => {
    assert.equal(weekdayOfYmd('2026-10-05'), 1);   // Monday
    assert.equal(weekdayOfYmd('2026-03-29'), 0);   // Sunday
    assert.equal(weekdayOfYmd('2000-02-29'), 2);
    assert.equal(daysBetweenYmd('2026-03-28', '2026-03-30'), 2);
    assert.equal(daysBetweenYmd('2026-12-31', '2026-01-01'), -364);
    // cross-check against every day of a span: addDays and daysBetween agree, weekday advances by one
    let d = '2025-12-25';
    for (let i = 0; i < 800; i++) {
        const next = addDaysYmd(d, 1);
        assert.equal(daysBetweenYmd(d, next), 1, d);
        assert.equal(weekdayOfYmd(next), (weekdayOfYmd(d) + 1) % 7, d);
        d = next;
    }
});
