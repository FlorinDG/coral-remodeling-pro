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
