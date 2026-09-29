/**
 * GATE 2 · HR write policy — the crew's real call paths must pass; everything else must be refused.
 * Each "passes" case is copied from the payload the app actually sends (file noted).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hrWriteRefusal } from '../src/app/api/hr/lib/write-policy.ts';

const ME = 'user-me';
const OTHER = 'user-other';
const crew = (entity: string, method: 'POST' | 'PATCH' | 'DELETE', data: Record<string, unknown>, existing: Record<string, unknown> | null = null) =>
    hrWriteRefusal(entity, method, false, ME, data, existing);
const hr = (entity: string, method: 'POST' | 'PATCH' | 'DELETE', data: Record<string, unknown>) =>
    hrWriteRefusal(entity, method, true, ME, data, null);

describe('crew call paths that must keep working', () => {
    test('clock in (useClockEntries — userId injected by the server)', () => {
        assert.equal(crew('clock-entries', 'POST', { userId: ME, clockInTime: 'x', clockInLatitude: 1, shiftId: 's' }), null);
    });
    test('clock in without shift (ClockButton fallback: pending)', () => {
        assert.equal(crew('clock-entries', 'POST', { userId: ME, requiresApproval: true, approvalStatus: 'pending' }), null);
    });
    test('late entry (LateEntryForm: pending, source late_entry)', () => {
        assert.equal(crew('clock-entries', 'POST', { userId: ME, clockInTime: 'a', clockOutTime: 'b', projectId: null, shiftId: null, requiresApproval: true, approvalStatus: 'pending', source: 'late_entry' }), null);
    });
    test('link the new shift to my open entry (ClockButton PATCH shiftId)', () => {
        assert.equal(crew('clock-entries', 'PATCH', { shiftId: 's' }, { userId: ME, clockOutTime: null }), null);
    });
    test('clock out (useClockEntries PATCH)', () => {
        assert.equal(crew('clock-entries', 'PATCH', { clockOutTime: 'x', taskDescription: 't', clockOutLatitude: 1, clockOutLongitude: 2, photos: [], noBreak: false }, { userId: ME, clockOutTime: null }), null);
    });
    test('request time off (TimeOffScreen / TimeOffRequestForm)', () => {
        assert.equal(crew('time-off', 'POST', { userId: ME, requestType: 'Vacation', startDate: 'a', endDate: 'b' }), null);
    });
    test('withdraw my pending request (TimeOffScreen)', () => {
        assert.equal(crew('time-off', 'PATCH', { status: 'cancelled' }, { userId: ME, status: 'pending' }), null);
    });
    test('file a request (useApprovalRequests / Profile email change)', () => {
        assert.equal(crew('approval-requests', 'POST', { userId: ME, requestedBy: ME, status: 'pending', requestType: 'late_entry' }), null);
    });
});

describe('what the crew may not do', () => {
    test('approve own hours on create', () => {
        assert.equal(crew('clock-entries', 'POST', { userId: ME, approvalStatus: 'approved' })?.code, 'approval_requires_hr_role');
    });
    test('clock a colleague in', () => {
        assert.equal(crew('clock-entries', 'POST', { userId: OTHER })?.code, 'own_records_only');
    });
    test('pose as an admin entry', () => {
        assert.equal(crew('clock-entries', 'POST', { userId: ME, source: 'admin_entry' })?.code, 'requires_hr_role');
    });
    test('approve own entry by PATCH', () => {
        assert.equal(crew('clock-entries', 'PATCH', { approvalStatus: 'approved' }, { userId: ME, clockOutTime: null })?.code, 'requires_hr_role');
    });
    test('move own clock-in time', () => {
        assert.equal(crew('clock-entries', 'PATCH', { clockInTime: 'x' }, { userId: ME, clockOutTime: null })?.code, 'requires_hr_role');
    });
    test('change a closed entry\'s clock-out', () => {
        assert.equal(crew('clock-entries', 'PATCH', { clockOutTime: 'x' }, { userId: ME, clockOutTime: 'y' })?.code, 'requires_hr_role');
    });
    test('edit a colleague\'s entry', () => {
        assert.equal(crew('clock-entries', 'PATCH', { taskDescription: 'x' }, { userId: OTHER, clockOutTime: null })?.code, 'own_records_only');
    });
    test('delete hours', () => {
        assert.equal(crew('clock-entries', 'DELETE', {})?.code, 'requires_hr_role');
    });
    test('approve own leave', () => {
        assert.equal(crew('time-off', 'PATCH', { status: 'approved' }, { userId: ME, status: 'pending' })?.code, 'approval_requires_hr_role');
        assert.equal(crew('time-off', 'POST', { userId: ME, status: 'approved' })?.code, 'approval_requires_hr_role');
    });
    test('withdraw an approved absence', () => {
        assert.equal(crew('time-off', 'PATCH', { status: 'cancelled' }, { userId: ME, status: 'approved' })?.code, 'requires_hr_role');
    });
    test('approve an approval request', () => {
        assert.equal(crew('approval-requests', 'PATCH', { status: 'approved' })?.code, 'approval_requires_hr_role');
    });
    test('touch the back office', () => {
        for (const e of ['employees', 'teams', 'team-members', 'shift-templates', 'worker-schedules', 'projects']) {
            for (const m of ['POST', 'PATCH', 'DELETE'] as const) {
                assert.equal(crew(e, m, { hourlyCost: 99 })?.code, 'requires_hr_role', `${m} ${e}`);
            }
        }
    });
});

describe('tenant HR roles', () => {
    test('pass every write (the seraph still scopes them to the tenant)', () => {
        assert.equal(hr('clock-entries', 'POST', { userId: OTHER, approvalStatus: 'approved', source: 'admin_entry' }), null);
        assert.equal(hr('employees', 'PATCH', { hourlyCost: 30 }), null);
        assert.equal(hr('time-off', 'PATCH', { status: 'approved' }), null);
        assert.equal(hr('approval-requests', 'PATCH', { status: 'approved' }), null);
    });
});

describe('not yet gated — Gate 2 phase 2 (recorded, rides with R1-4)', () => {
    test('shift self-service is unchanged in this pass', () => {
        assert.equal(crew('shifts', 'POST', { userId: ME }), null);
        assert.equal(crew('shift-tasks', 'PATCH', {}), null);
    });
});
