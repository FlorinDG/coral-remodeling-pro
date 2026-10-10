/**
 * TRACE-1 (Florin 2026-10-10): "both shift and hours clocked get a trace number … cross linking between the shift and
 * hours … the closed shifts must display under the line of the scheduled hours another line holding the actual hours
 * and their calculation … number must also appear where unassigned hours need to be linked with a shift".
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatTraceNo, isTraceNo, TRACE_SERIES } from '../src/lib/records/trace-number.ts';
import { nextTraceNo } from '../src/lib/data/trace-number.ts';
import { shiftActuals } from '../src/lib/records/shift-actuals.ts';

describe('TRACE-1 · the number (core)', () => {
    test('SH-00123 / HR-00456: five digits, wider past 99999, never truncated', () => {
        assert.equal(formatTraceNo(TRACE_SERIES.shift, 123), 'SH-00123');
        assert.equal(formatTraceNo(TRACE_SERIES.hours, 456), 'HR-00456');
        assert.equal(formatTraceNo(TRACE_SERIES.hours, 123456), 'HR-123456');
        assert.throws(() => formatTraceNo(TRACE_SERIES.shift, 0));
    });
    test('recognised in text, per series', () => {
        assert.equal(isTraceNo('sh-00012'), true);
        assert.equal(isTraceNo('HR-00012', TRACE_SERIES.shift), false);
        assert.equal(isTraceNo('SH-12'), false);
    });
});

describe('TRACE-1 · the door', () => {
    test('one atomic upsert: created at 1, else incremented — then formatted', async () => {
        const calls: unknown[] = [];
        const db = { traceCounter: { upsert: async (a: unknown) => { calls.push(a); return { value: 7 }; } } };
        assert.equal(await nextTraceNo(db, 't1', TRACE_SERIES.shift), 'SH-00007');
        assert.deepEqual(calls[0], { where: { tenantId_series: { tenantId: 't1', series: 'SH' } }, create: { tenantId: 't1', series: 'SH', value: 1 }, update: { value: { increment: 1 } }, select: { value: true } });
        await assert.rejects(() => nextTraceNo(db, '', TRACE_SERIES.shift));
    });
});

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
}

describe('TRACE-1 · every creation is numbered', () => {
    test('each create of a ClockEntry or ScheduledShift asks the door in the same transaction', () => {
        const missing: string[] = [];
        for (const f of sources('src')) {
            const s = readFileSync(f, 'utf8');
            for (const m of s.matchAll(/\b(?:clockEntry|scheduledShift)\.create\(/g)) {
                const around = s.slice(Math.max(0, m.index! - 200), m.index! + 400);
                if (!/nextTraceNo\(/.test(around)) missing.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
            }
        }
        assert.deepEqual(missing, []);
        const route = readFileSync('src/app/api/hr/[entity]/route.ts', 'utf8');
        assert.match(route, /data\.traceNo = await nextTraceNo\(tx, ctx\.tenantId, series\);/);
        assert.match(route, /const PROTECTED_FIELDS = \[[^\]]*'traceNo'\]/, 'a client never sets the number');
    });
});

describe('TRACE-1 · the actual hours of a closed shift (core)', () => {
    test('first in – last out (Brussels), worked after the break rule, the break shown', () => {
        const a = shiftActuals([
            { clockInTime: '2026-10-09T06:00:00.000Z', clockOutTime: '2026-10-09T10:00:00.000Z', traceNo: 'HR-00001' },   // 08:00–12:00, 4h, no break
            { clockInTime: '2026-10-09T10:30:00.000Z', clockOutTime: '2026-10-09T15:00:00.000Z', traceNo: 'HR-00002' },   // 12:30–17:00, 4h30 − 30m
        ]);
        assert.ok(a);
        assert.equal(a.start, '08:00');
        assert.equal(a.end, '17:00');
        assert.equal(a.workedMinutes, 240 + 240);
        assert.equal(a.breakMinutes, 30);
        assert.deepEqual(a.entries.map(e => e.traceNo), ['HR-00001', 'HR-00002']);
    });
    test('not closed (an entry still open) or nothing clocked → no actual line', () => {
        assert.equal(shiftActuals([{ clockInTime: '2026-10-09T06:00:00.000Z', clockOutTime: null }]), null);
        assert.equal(shiftActuals([]), null);
    });
});

describe('TRACE-1 · on screen', () => {
    const read = (p: string) => readFileSync(p, 'utf8');
    test('the planned line of the matrix and the table carry the actual line', () => {
        assert.match(read('src/components/time-tracker/components/schedule/ScheduleMatrixView.tsx'), /<ShiftActualsLine entries=\{shift\.clockEntries\} \/>/);
        assert.match(read('src/components/time-tracker/components/schedule/ScheduleTable.tsx'), /<ShiftActualsLine entries=\{row\.original\.rawShift\.clockEntries\} \/>/);
    });
    test('the shift links to its hours; the hours link to their shift; each side opens the other', () => {
        assert.match(read('src/components/time-tracker/components/schedule/shift-editor/EditShiftDialog.tsx'), /<ShiftTraceLinks traceNo=/);
        assert.match(read('src/components/time-tracker/components/schedule/shift-editor/components/ShiftTraceLinks.tsx'), /entry=\$\{encodeURIComponent\(entry\.id\)\}/);
        assert.match(read('src/components/time-tracker/components/timesheets/TimesheetEntryDetail.tsx'), /time-tracker\/schedule\?shift=\$\{encodeURIComponent\(shiftCtx\.shiftId\)\}&date=\$\{shiftCtx\.shiftDate\}/);
        assert.match(read('src/app/[locale]/admin/hr/timesheets/page.tsx'), /setExpandedRowId\(entryParam\)/);
        assert.match(read('src/components/time-tracker/components/admin/ScheduleManagement.tsx'), /const target = shifts\.find\(sh => sh\.id === linkedShiftId\);/);
    });
    test('the numbers show in the timesheet row and where unlinked hours wait for their shift', () => {
        assert.match(read('src/app/[locale]/admin/hr/timesheets/page.tsx'), /\{entry\.traceNo && <div/);
        const review = read('src/components/shift-link/ShiftLinkReview.tsx');
        assert.match(review, /\{item\.traceNo && <span/);
        assert.match(review, /o\.traceNo \? `\$\{o\.traceNo\} · `/);
    });
});
