import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { labourForProject } from '../src/lib/data/project-labour.ts';

test('WH-5a · project_id is strictly forbidden in src/lib/data/project-labour.ts', () => {
    const filePath = path.resolve(import.meta.dirname, '../src/lib/data/project-labour.ts');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
        !sourceCode.includes('project_id'),
        'Forbidden: "project_id" must not appear in src/lib/data/project-labour.ts'
    );
});

test('WH-5a · ProjectDetailView has zero time-tracker imports', () => {
    const filePath = path.resolve(
        import.meta.dirname,
        '../src/components/admin/database/components/ProjectDetailView.tsx'
    );
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
        !sourceCode.includes('time-tracker'),
        'Forbidden: "time-tracker" imports must not appear in ProjectDetailView.tsx'
    );
    assert.ok(
        !sourceCode.includes('useClockEntries'),
        'Forbidden: "useClockEntries" must not appear in ProjectDetailView.tsx'
    );
    assert.ok(
        !sourceCode.includes('useScheduledShifts'),
        'Forbidden: "useScheduledShifts" must not appear in ProjectDetailView.tsx'
    );
});

test('WH-5a · labourForProject returns zero summary when no entries exist', async () => {
    const mockClient = {
        scheduledShift: {
            findMany: async () => [
                { id: 'shift-1', shiftDate: '2026-09-20', workerIds: ['user-1'] }
            ],
        },
        clockEntry: {
            findMany: async () => [],
        },
    };

    const res = await labourForProject({ tenantId: 'tenant-1' }, 'proj-123', mockClient);
    assert.equal(res.hours, 0);
    assert.equal(res.entryCount, 0);
    assert.equal(res.shiftCount, 1);
    assert.deepEqual(res.byWorker, []);
    assert.equal(res.shifts.length, 1);
});

test('WH-5a · labourForProject computes hours and byWorker breakdown correctly', async () => {
    let capturedShiftWhere: any = null;
    let capturedEntryWhere: any = null;

    const mockClient = {
        scheduledShift: {
            findMany: async ({ where }: any) => {
                capturedShiftWhere = where;
                return [
                    { id: 'shift-1', shiftDate: '2026-09-20', workerIds: ['user-1', 'user-2'] }
                ];
            },
        },
        clockEntry: {
            findMany: async ({ where }: any) => {
                capturedEntryWhere = where;
                return [
                    {
                        id: 'entry-1',
                        userId: 'user-1',
                        clockInTime: '2026-09-20T08:00:00.000Z',
                        clockOutTime: '2026-09-20T12:00:00.000Z',
                        noBreak: true, // 4 hours
                    },
                    {
                        id: 'entry-2',
                        userId: 'user-2',
                        clockInTime: '2026-09-20T08:00:00.000Z',
                        clockOutTime: '2026-09-20T10:30:00.000Z',
                        noBreak: true, // 2.5 hours
                    },
                ];
            },
        },
    };

    const res = await labourForProject({ tenantId: 'tenant-test' }, 'proj-456', mockClient);

    // Verify relation traversal in Prisma query
    assert.equal(capturedShiftWhere.tenantId, 'tenant-test');
    assert.equal(capturedShiftWhere.projectId, 'proj-456');
    assert.equal(capturedEntryWhere.tenantId, 'tenant-test');
    assert.deepEqual(capturedEntryWhere.shift, { projectId: 'proj-456', tenantId: 'tenant-test' });

    // Verify calculation
    assert.equal(res.hours, 6.5);
    assert.equal(res.entryCount, 2);
    assert.equal(res.shiftCount, 1);
    assert.deepEqual(res.byWorker, [
        { userId: 'user-1', hours: 4 },
        { userId: 'user-2', hours: 2.5 },
    ]);
});
