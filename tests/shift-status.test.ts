import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftStatus, storedStatus, wasLate, isWritableShiftStatus, SHIFT_STATUS_OPTIONS } from '../src/lib/kernel/shift-status.ts';

// Instants given in UTC; Brussels is UTC+2 on 2026-10-08 (summer time).
const shift = { shiftDate: '2026-10-08', shiftStart: '08:00', status: 'scheduled' };
const at = (utc: string) => new Date(utc);

test('a new shift is Scheduled until its start', () => {
    assert.equal(shiftStatus(shift, [], at('2026-10-08T05:59:00Z')), 'scheduled');   // 07:59 Brussels
});

test('Florin 2026-10-08: no clock-in at the start → Late', () => {
    assert.equal(shiftStatus(shift, [], at('2026-10-08T06:00:00Z')), 'late');        // 08:00 Brussels
    assert.equal(shiftStatus(shift, [], at('2026-10-09T10:00:00Z')), 'late');        // next day, never came
});

test('the business clock decides, not UTC: 06:30Z is 08:30 in Brussels — late', () => {
    // A UTC reading (06:30 < 08:00) would still say scheduled; the worker is half an hour late.
    assert.equal(shiftStatus(shift, [], at('2026-10-08T06:30:00Z')), 'late');
    // A clock-in at 05:50Z is 07:50 Brussels — on time (a UTC reading would agree; the clock-out side is the trap).
    assert.equal(wasLate(shift, [{ clockInTime: '2026-10-08T05:50:00Z', clockOutTime: '2026-10-08T14:00:00Z' }], at('2026-10-08T15:00:00Z')), false);
});

test('clocked in and still working → In progress, even when it started late', () => {
    const open = [{ clockInTime: '2026-10-08T06:20:00Z', clockOutTime: null }];
    assert.equal(shiftStatus(shift, open, at('2026-10-08T09:00:00Z')), 'in-progress');
    assert.equal(wasLate(shift, open, at('2026-10-08T09:00:00Z')), true);            // 08:20 > 08:00
});

test('clocked in on time and out again → not late', () => {
    const done = [{ clockInTime: '2026-10-08T05:55:00Z', clockOutTime: '2026-10-08T14:00:00Z' }];
    assert.equal(shiftStatus(shift, done, at('2026-10-08T15:00:00Z')), 'scheduled');
    assert.equal(wasLate(shift, done, at('2026-10-08T15:00:00Z')), false);
});

test('cancelled and completed are what was written — clocks do not overrule them', () => {
    assert.equal(shiftStatus({ ...shift, status: 'cancelled' }, [], at('2026-10-09T10:00:00Z')), 'cancelled');
    assert.equal(shiftStatus({ ...shift, status: 'Completed' }, [{ clockInTime: '2026-10-08T06:00:00Z' }], at('2026-10-09T10:00:00Z')), 'completed');
});

test('a person may mark Late by hand; it stays Late', () => {
    assert.equal(shiftStatus({ ...shift, status: 'late' }, [], at('2026-10-08T05:00:00Z')), 'late');
});

test('legacy spellings read as the canonical stored status', () => {
    assert.equal(storedStatus('Scheduled'), 'scheduled');
    assert.equal(storedStatus('Active'), 'scheduled');
    assert.equal(storedStatus('In Progress'), 'scheduled');
    assert.equal(storedStatus('Cancelled'), 'cancelled');
    assert.equal(storedStatus(null), 'scheduled');
});

test('the select: Active is gone, Late is in; in-progress is shown but cannot be written', () => {
    assert.deepEqual([...SHIFT_STATUS_OPTIONS], ['scheduled', 'late', 'in-progress', 'completed', 'cancelled']);
    assert.equal(isWritableShiftStatus('late'), true);
    assert.equal(isWritableShiftStatus('in-progress'), false);
    assert.equal(isWritableShiftStatus('Active'), false);
    assert.equal(isWritableShiftStatus('leave'), false);
});
