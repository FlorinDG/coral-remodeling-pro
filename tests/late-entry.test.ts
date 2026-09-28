import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('LATE-ENTRY · ENTITY_MAP in HR API includes scheduled-shifts alias', () => {
    const routePath = path.resolve(import.meta.dirname, '../src/app/api/hr/[entity]/route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');

    assert.ok(
        content.includes("'scheduled-shifts': 'scheduledShift'"),
        'Expected scheduled-shifts to be registered in ENTITY_MAP'
    );
});

test('LATE-ENTRY · LateEntryForm sets requiresApproval and pending status', () => {
    const formPath = path.resolve(
        import.meta.dirname,
        '../src/components/time-tracker/components/LateEntryForm.tsx'
    );
    const content = fs.readFileSync(formPath, 'utf-8');

    assert.ok(
        content.includes("requiresApproval: true"),
        'LateEntryForm must set requiresApproval: true'
    );
    assert.ok(
        content.includes("approvalStatus: 'pending'"),
        'LateEntryForm must set approvalStatus to pending'
    );
    assert.ok(
        content.includes("source: 'late_entry'"),
        'LateEntryForm must set source to late_entry'
    );
    assert.ok(
        !content.includes("clockEntryId: clockEntry.id,\n          createdBy"),
        'LateEntryForm must not write non-existent clockEntryId to shift'
    );
});

test('LATE-ENTRY · useApprovalRequests createRequest persists via hrCreate', () => {
    const hookPath = path.resolve(
        import.meta.dirname,
        '../src/components/time-tracker/hooks/useApprovalRequests.ts'
    );
    const content = fs.readFileSync(hookPath, 'utf-8');

    assert.ok(
        content.includes("hrCreate<any>('approval-requests'"),
        'useApprovalRequests.createRequest must call hrCreate on approval-requests'
    );
    assert.ok(
        !content.includes('// Scaffold no-op'),
        'useApprovalRequests must not have dead scaffold stub'
    );
});

test('LATE-ENTRY · submitLateEntry links shiftId and sets requiresApproval', () => {
    const actionPath = path.resolve(
        import.meta.dirname,
        '../src/app/actions/timesheets.ts'
    );
    const content = fs.readFileSync(actionPath, 'utf-8');

    assert.ok(
        !content.includes('shiftId: projectId'),
        'submitLateEntry must never set shiftId: projectId'
    );
    assert.ok(
        content.includes("requiresApproval: true"),
        'submitLateEntry must set requiresApproval: true'
    );
    assert.ok(
        content.includes("approvalStatus: 'pending'"),
        'submitLateEntry must set approvalStatus: pending'
    );
    assert.ok(
        content.includes("requestType: 'late_entry'"),
        'submitLateEntry must create approval request with requestType: late_entry'
    );
});
