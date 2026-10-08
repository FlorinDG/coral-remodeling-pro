import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absenceDays, absenceOn, leaveConflicts, isBlockingAbsence } from '../src/lib/kernel/absence.ts';

const holiday = { id: 't1', userId: 'u1', startDate: '2026-10-30', endDate: '2026-11-02', status: 'approved', requestType: 'vacation' };

test('an absence covers every day from start to end — across a month and the clock change', () => {
    assert.deepEqual(absenceDays(holiday), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    assert.deepEqual(absenceDays({ startDate: '2026-10-25', endDate: '2026-10-26' }), ['2026-10-25', '2026-10-26']);
});

test('a reversed or broken range never loops', () => {
    assert.deepEqual(absenceDays({ startDate: '2026-10-05', endDate: '2026-10-01' }), ['2026-10-05']);
    assert.ok(absenceDays({ startDate: '2026-01-01', endDate: '2030-01-01' }).length <= 366);
});

test('Florin 2026-10-08: a shift on a day of leave is a conflict', () => {
    const shifts = [
        { id: 's-in', userId: 'u1', shiftDate: '2026-11-01', status: 'scheduled' },
        { id: 's-after', userId: 'u1', shiftDate: '2026-11-03', status: 'scheduled' },
        { id: 's-other', userId: 'u2', shiftDate: '2026-11-01', status: 'scheduled' },
        { id: 's-cancelled', userId: 'u1', shiftDate: '2026-10-31', status: 'cancelled' },
    ];
    const c = leaveConflicts(shifts, [holiday]);
    assert.deepEqual(c.map(x => x.shiftId), ['s-in']);
    assert.equal(c[0].pending, false);
});

test('asked-for leave is flagged too; refused or cancelled leave is not', () => {
    const s = [{ id: 's', userId: 'u1', shiftDate: '2026-10-30' }];
    assert.equal(leaveConflicts(s, [{ ...holiday, status: 'pending' }])[0]?.pending, true);
    assert.equal(leaveConflicts(s, [{ ...holiday, status: 'rejected' }]).length, 0);
    assert.equal(leaveConflicts(s, [{ ...holiday, status: 'cancelled' }]).length, 0);
    assert.equal(isBlockingAbsence({ status: 'Approved' }), true);
});

test('a one-day request with a timestamped date still matches its day', () => {
    assert.ok(absenceOn([{ ...holiday, startDate: '2026-10-30T00:00:00.000Z', endDate: '' }], 'u1', '2026-10-30'));
});
