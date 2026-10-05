import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateShiftForm,
  expandRecurringShiftDates,
  expandRangeShiftDates,
  buildCreateShiftPayloads,
  buildUpdateShiftPayload,
  buildRecurringExpansionFromExisting,
  evaluateShiftLockState,
  type ShiftEditorFormInput,
} from '../src/components/time-tracker/components/schedule/shift-editor/model.ts';
import { weekdayOfYmd } from '../src/lib/kernel/shift-time.ts';

// ── 1. VALIDATION ─────────────────────────────────────────────────────────────

test('validateShiftForm: rejects missing workers', () => {
  const res = validateShiftForm({
    userIds: [],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  });
  assert.equal(res.valid, false);
  assert.equal(res.errors.userIds, 'Please select at least one employee');
});

test('validateShiftForm: rejects missing date', () => {
  const res = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  });
  assert.equal(res.valid, false);
  assert.equal(res.errors.shiftDate, 'Date is required');
});

test('validateShiftForm: rejects end date before start date', () => {
  const res = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-10',
    shiftEndDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  });
  assert.equal(res.valid, false);
  assert.equal(res.errors.shiftEndDate, 'End date must be after start date');
});

test('validateShiftForm: rejects missing start or end time', () => {
  const resNoStart = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  });
  assert.equal(resNoStart.valid, false);
  assert.equal(resNoStart.errors.shiftStart, 'Start time is required');

  const resNoEnd = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '',
    materialsEnabled: false,
    scheduleType: 'single',
  });
  assert.equal(resNoEnd.valid, false);
  assert.equal(resNoEnd.errors.shiftEnd, 'End time is required');
});

test('validateShiftForm: rejects recurring without selected days or valid weeks', () => {
  const resNoDays = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'recurring',
    recurringWeeks: 4,
    selectedDays: [],
  });
  assert.equal(resNoDays.valid, false);
  assert.equal(resNoDays.errors.selectedDays, 'Please select at least one day for recurring shifts');

  const resNoWeeks = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'recurring',
    recurringWeeks: 0,
    selectedDays: [1],
  });
  assert.equal(resNoWeeks.valid, false);
  assert.equal(resNoWeeks.errors.recurringWeeks, 'Weeks must be at least 1');
});

test('validateShiftForm: rejects leave without leaveReason', () => {
  const res = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'leave',
    leaveReason: '   ',
  });
  assert.equal(res.valid, false);
  assert.equal(res.errors.leaveReason, 'Leave reason is required');
});

test('validateShiftForm: passes on valid input', () => {
  const res = validateShiftForm({
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  });
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, {});
});

// ── 2. RECURRING & RANGE EXPANSION (C3 / C5) ──────────────────────────────────

test('expandRecurringShiftDates: characterizes CreateShiftForm.tsx:463-470 recurrence loop', () => {
  // Start Monday 2026-10-05, repeat 2 weeks, days = [1, 3, 5] (Mon, Wed, Fri)
  const dates = expandRecurringShiftDates('2026-10-05', 2, [1, 3, 5]);
  assert.deepEqual(dates, [
    '2026-10-05', // Week 0 Mon
    '2026-10-07', // Week 0 Wed
    '2026-10-09', // Week 0 Fri
    '2026-10-12', // Week 1 Mon
    '2026-10-14', // Week 1 Wed
    '2026-10-16', // Week 1 Fri
  ]);
});

test('expandRecurringShiftDates: DST spring transition safe (Europe/Brussels)', () => {
  // Spring clock change in Europe/Brussels is night of 2026-03-28 to 2026-03-29.
  // Start Monday 2026-03-23, repeat 2 weeks on Sunday (0) and Monday (1).
  const dates = expandRecurringShiftDates('2026-03-23', 2, [0, 1]);

  // Sunday of week 0 is 2026-03-29 (clock change day).
  // Monday of week 1 is 2026-03-30.
  // Sunday of week 1 is 2026-04-05.
  assert.deepEqual(dates, [
    '2026-03-23', // Mon w0
    '2026-03-29', // Sun w0 (spring DST transition day)
    '2026-03-30', // Mon w1 (post-DST)
    '2026-04-05', // Sun w1
  ]);

  // Check each day matches Sakamoto weekdayOfYmd:
  assert.equal(weekdayOfYmd(dates[0]), 1); // Mon
  assert.equal(weekdayOfYmd(dates[1]), 0); // Sun
  assert.equal(weekdayOfYmd(dates[2]), 1); // Mon
  assert.equal(weekdayOfYmd(dates[3]), 0); // Sun
});

test('expandRangeShiftDates: characterizes CreateShiftForm.tsx:525-528 range with weekend exclusion', () => {
  // Friday to Monday: 2026-10-09 to 2026-10-12
  const withoutWeekends = expandRangeShiftDates('2026-10-09', '2026-10-12', false);
  assert.deepEqual(withoutWeekends, [
    '2026-10-09', // Friday
    '2026-10-12', // Monday (Sat 10-10 and Sun 10-11 excluded)
  ]);

  const withWeekends = expandRangeShiftDates('2026-10-09', '2026-10-12', true);
  assert.deepEqual(withWeekends, [
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
  ]);
});

// ── 3. PAYLOAD CONSTRUCTION & CAMELCASE (C2 / C5) ─────────────────────────────

test('buildCreateShiftPayloads: produces strictly camelCase keys — zero snake_case (C2)', () => {
  const form: ShiftEditorFormInput = {
    userIds: ['u1', 'u2'],
    projectId: 'p1',
    contactPageId: 'cp1',
    shiftDate: '2026-10-05',
    shiftStart: '08:30',
    shiftEnd: '17:00',
    role: 'Lead',
    notes: 'Office notes',
    siteAddress: 'Street 1',
    materialsEnabled: true,
    scheduleType: 'single',
  };

  const payloads = buildCreateShiftPayloads(form, () => 'series-fixed-1');
  assert.equal(payloads.length, 2);

  for (const p of payloads) {
    for (const key of Object.keys(p)) {
      assert.ok(
        !key.includes('_'),
        `Forbidden snake_case key '${key}' found in payload! (C2 requires camelCase)`
      );
    }
    assert.equal(p.userId.startsWith('u'), true);
    assert.equal(p.projectId, 'p1');
    assert.equal(p.contactPageId, 'cp1');
    assert.equal(p.shiftDate, '2026-10-05');
    assert.equal(p.shiftStart, '08:30');
    assert.equal(p.shiftEnd, '17:00');
    assert.equal(p.role, 'Lead');
    assert.equal(p.notes, 'Office notes');
    assert.equal(p.siteAddress, 'Street 1');
    assert.equal(p.materialsEnabled, true);
    assert.equal(p.status, 'scheduled');
  }
});

test('buildCreateShiftPayloads: solo worker on single day has seriesId undefined (CreateShiftForm.tsx:520)', () => {
  const form: ShiftEditorFormInput = {
    userIds: ['u1'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  };

  const payloads = buildCreateShiftPayloads(form);
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].seriesId, undefined);
});

test('buildCreateShiftPayloads: multiple workers on single day share same seriesId (CreateShiftForm.tsx:520 WO-2)', () => {
  const form: ShiftEditorFormInput = {
    userIds: ['u1', 'u2', 'u3'],
    shiftDate: '2026-10-05',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    materialsEnabled: false,
    scheduleType: 'single',
  };

  const payloads = buildCreateShiftPayloads(form, () => 'shared-wo-series');
  assert.equal(payloads.length, 3);
  assert.equal(payloads[0].seriesId, 'shared-wo-series');
  assert.equal(payloads[1].seriesId, 'shared-wo-series');
  assert.equal(payloads[2].seriesId, 'shared-wo-series');
});

test('buildCreateShiftPayloads: characterizes leave shift formatting (CreateShiftForm.tsx:532-544)', () => {
  const form: ShiftEditorFormInput = {
    userIds: ['u1'],
    projectId: 'p-should-be-ignored',
    shiftDate: '2026-10-05',
    shiftStart: '07:00', // user custom times
    shiftEnd: '19:00',
    notes: 'special request',
    materialsEnabled: true,
    scheduleType: 'leave',
    leaveReason: 'Doctor',
  };

  const payloads = buildCreateShiftPayloads(form);
  assert.equal(payloads.length, 1);
  const p = payloads[0];
  // Leave enforces standard hours, null project/siteAddress, materials false, and formatted notes
  assert.equal(p.shiftStart, '08:00');
  assert.equal(p.shiftEnd, '17:00');
  assert.equal(p.projectId, null);
  assert.equal(p.siteAddress, null);
  assert.equal(p.materialsEnabled, false);
  assert.equal(p.status, 'leave');
  assert.equal(p.shiftName, 'Doctor');
  assert.equal(p.notes, 'Leave: Doctor - special request');
});

test('buildUpdateShiftPayload: produces strictly camelCase update payload', () => {
  const form: ShiftEditorFormInput = {
    userIds: ['u1'],
    projectId: 'p2',
    shiftDate: '2026-10-05',
    shiftStart: '09:00',
    shiftEnd: '17:30',
    role: 'Supervisor',
    notes: 'Updated notes',
    siteAddress: 'Jobsite 9',
    materialsEnabled: true,
    scheduleType: 'single',
  };

  const update = buildUpdateShiftPayload(form, 'series-existing');
  for (const key of Object.keys(update)) {
    assert.ok(!key.includes('_'), `Forbidden snake_case key '${key}' in update payload`);
  }
  assert.equal(update.userId, 'u1');
  assert.equal(update.projectId, 'p2');
  assert.equal(update.shiftStart, '09:00');
  assert.equal(update.seriesId, 'series-existing');
});

test('buildRecurringExpansionFromExisting: skips existing shiftDate (EditShiftDialog.tsx:337)', () => {
  const form: ShiftEditorFormInput = {
    userIds: ['u1'],
    projectId: 'p1',
    shiftDate: '2026-10-05', // Monday
    shiftStart: '08:00',
    shiftEnd: '16:30',
    materialsEnabled: false,
    scheduleType: 'recurring',
    recurringWeeks: 2,
    selectedDays: [1, 3], // Mon, Wed
  };

  // The existing shift is on Monday 2026-10-05.
  // The expansion should produce shifts for Wednesday 10-07, Monday 10-12, Wednesday 10-14 (3 shifts).
  const additions = buildRecurringExpansionFromExisting(form, '2026-10-05', 'series-new');
  assert.equal(additions.length, 3);
  assert.deepEqual(additions.map(a => a.shiftDate), ['2026-10-07', '2026-10-12', '2026-10-14']);
  assert.ok(!additions.some(a => a.shiftDate === '2026-10-05'));
  assert.equal(additions[0].seriesId, 'series-new');
});

// ── 4. WORK ORDER LOCK STATE (C4) ─────────────────────────────────────────────

test('evaluateShiftLockState: locks ONLY when action sign row exists (C4)', () => {
  // Case A: Sign audit row exists
  const logsWithSign = [
    { action: 'create', createdAt: '2026-10-01T08:00:00Z' },
    {
      action: 'sign',
      createdAt: '2026-10-04T16:00:00Z',
      after: { number: 'WB-2026-0042', signerName: 'Familie Dupont' },
    },
  ];

  const lock = evaluateShiftLockState(logsWithSign);
  assert.equal(lock.locked, true);
  assert.equal(lock.signedNumber, 'WB-2026-0042');
  assert.equal(lock.signedBy, 'Familie Dupont');
  assert.equal(lock.signedAt, '2026-10-04T16:00:00Z');
  assert.equal(lock.reason, 'client signature');

  // Case B: No sign audit row -> NOT locked
  const logsNoSign = [
    { action: 'create', createdAt: '2026-10-01T08:00:00Z' },
    { action: 'update', createdAt: '2026-10-02T09:00:00Z' },
  ];
  const unlock = evaluateShiftLockState(logsNoSign);
  assert.equal(unlock.locked, false);

  // Case C: Empty or undefined logs -> NOT locked
  assert.equal(evaluateShiftLockState([]).locked, false);
  assert.equal(evaluateShiftLockState(null).locked, false);
  assert.equal(evaluateShiftLockState(undefined).locked, false);
});
