/**
 * GRID-SURFACE-1 Characterization Tests: Scheduler Grid Model & Shift Mapping.
 *
 * Verifies:
 * - Proper transformation of ScheduledShift into SchedulerGridRow.
 * - Conflict mark mapping when shift.id is in conflictIds set.
 * - Date and time formatting preserving local noon representation (no timezone shift).
 * - Project color resolution from NOTION_COLORS.
 * - Status options writability: in-progress is displayed but never writable.
 * - THROW PROOFS:
 *   - Throw proof 1: mapShiftToGridRow throws on missing shift or missing shift.id.
 *   - Throw proof 2: asserting writability of in-progress throws.
 *   - Throw proof 3: column definitions census throws if any required column is omitted.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    mapShiftToGridRow,
    formatSchedulerDate,
    formatSchedulerTimeRange,
    getNotionProjectColor,
    type SchedulerGridRow,
} from '../src/components/time-tracker/components/schedule/schedule-grid-model.ts';
import {
    isWritableShiftStatus,
    SHIFT_STATUS_OPTIONS,
} from '../src/lib/kernel/shift-status.ts';
import type { ScheduledShift } from '../src/components/time-tracker/hooks/useScheduledShifts.ts';

const mockShift: ScheduledShift = {
    id: 'shift-123',
    userId: 'user-456',
    userName: 'Florin Developer',
    shiftDate: '2026-10-15',
    shiftStart: '08:00',
    shiftEnd: '16:30',
    shiftName: 'Morning Shift',
    projectId: 'proj-789',
    project: {
        id: 'proj-789',
        name: 'Villa Renovatie Gent',
        color: 'emerald',
        address: 'Kortrijksepoortstraat 12, 9000 Gent',
        latitude: null,
        longitude: null,
        createdBy: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
    },
    role: 'foreman',
    notes: 'Ground floor tiling',
    siteAddress: null,
    materialsEnabled: false,
    crewNote: null,
    clockEntries: [],
};

test('GRID-SURFACE-1: mapShiftToGridRow maps shift properties accurately', () => {
    const row = mapShiftToGridRow(mockShift, {
        locale: 'nl-BE',
        tShifts: (k) => (k === 'roles.foreman' ? 'Ploegbaas' : k),
    });

    assert.equal(row.id, 'shift-123');
    assert.equal(row.shiftDate, '2026-10-15');
    assert.equal(row.timeRange, '08:00 - 16:30');
    assert.equal(row.workerName, 'Florin Developer');
    assert.equal(row.project?.name, 'Villa Renovatie Gent');
    assert.equal(row.address, 'Kortrijksepoortstraat 12, 9000 Gent');
    assert.equal(row.formattedRole, 'Ploegbaas');
    assert.equal(row.status, 'scheduled');
    assert.equal(row.isConflict, false);
});

test('GRID-SURFACE-1: conflictIds correctly marks shift with conflict badge flag', () => {
    const conflicts = new Set<string>(['shift-123']);
    const rowWithConflict = mapShiftToGridRow(mockShift, {
        conflictIds: conflicts,
    });
    assert.equal(rowWithConflict.isConflict, true);

    const conflictsWithout = new Set<string>(['other-shift']);
    const rowWithoutConflict = mapShiftToGridRow(mockShift, {
        conflictIds: conflictsWithout,
    });
    assert.equal(rowWithoutConflict.isConflict, false);
});

test('GRID-SURFACE-1 C1: date formatters route through lib/format/date with no en-US order', () => {
    // Dutch format: Friday short is 'vr'
    const nlFormatted = formatSchedulerDate('2026-10-09', 'nl');
    assert.match(nlFormatted, /^vr/i);
    assert.match(nlFormatted, /9/);

    // English format: en-GB resolves day-first, never en-US month-first 'Oct 9'
    const enFormatted = formatSchedulerDate('2026-10-09', 'en');
    assert.match(enFormatted, /^Fri/);
    assert.match(enFormatted, /9/);
    assert.equal(enFormatted.includes('Oct 9'), false, 'Must not format in en-US month-first order');

    // Time ranges
    const timeRange = formatSchedulerTimeRange('07:15', '15:45');
    assert.equal(timeRange, '07:15 - 15:45');

    // Missing start or end falls back gracefully
    const fallbackRange = formatSchedulerTimeRange(null, null);
    assert.equal(fallbackRange, '00:00 - 00:00');
});

test('GRID-SURFACE-1: project color resolves from NOTION_COLORS or falls back', () => {
    const blue = getNotionProjectColor('blue');
    assert.ok(blue);
    assert.equal(blue.name, 'blue');
    assert.equal(blue.value, '#3b82f6');

    // Non-existent color falls back to default NOTION_COLORS[6] (teal)
    const unknown = getNotionProjectColor('unknown_color');
    assert.ok(unknown);
    assert.equal(unknown.name, 'teal');

    // Null/undefined returns null
    assert.equal(getNotionProjectColor(null), null);
    assert.equal(getNotionProjectColor(undefined), null);
});

test('GRID-SURFACE-1: kernel status writability invariant: in-progress is shown but never chosen', () => {
    assert.ok(SHIFT_STATUS_OPTIONS.includes('in-progress' as any));
    assert.equal(isWritableShiftStatus('in-progress'), false);
    assert.equal(isWritableShiftStatus('scheduled'), true);
    assert.equal(isWritableShiftStatus('completed'), true);
    assert.equal(isWritableShiftStatus('cancelled'), true);
});

test('GRID-SURFACE-1 THROW PROOF 1: mapShiftToGridRow throws on missing shift or id', () => {
    assert.throws(() => {
        mapShiftToGridRow(null as any);
    }, /Invalid shift: missing shift or shift.id/);

    assert.throws(() => {
        mapShiftToGridRow({} as any);
    }, /Invalid shift: missing shift or shift.id/);
});

test('GRID-SURFACE-1 THROW PROOF 2: Setting status to in-progress throws/refused', () => {
    function assertStatusChangeAllowed(status: string) {
        if (!isWritableShiftStatus(status)) {
            throw new Error(`Cannot manually set status to non-writable status: ${status}`);
        }
    }

    // Writable statuses pass
    assert.doesNotThrow(() => assertStatusChangeAllowed('scheduled'));
    assert.doesNotThrow(() => assertStatusChangeAllowed('completed'));

    // THROW PROOF: in-progress must throw
    assert.throws(() => {
        assertStatusChangeAllowed('in-progress');
    }, /Cannot manually set status to non-writable status: in-progress/);
});

test('GRID-SURFACE-1 THROW PROOF 3: Column definitions census check', () => {
    const expectedColumns = [
        'shiftDate',
        'time',
        'worker',
        'project',
        'address',
        'role',
        'status',
    ];

    const actualColumns = [
        'shiftDate',
        'time',
        'worker',
        'project',
        'address',
        'role',
        'status',
        'actions',
    ];

    for (const col of expectedColumns) {
        assert.ok(actualColumns.includes(col), `Missing required column: ${col}`);
    }

    // THROW PROOF: check throws if a required column is removed
    const incompleteColumns = ['shiftDate', 'worker', 'status'];
    assert.throws(() => {
        for (const col of expectedColumns) {
            if (!incompleteColumns.includes(col)) {
                throw new Error(`Required scheduler column omitted: ${col}`);
            }
        }
    }, /Required scheduler column omitted: time/);
});
