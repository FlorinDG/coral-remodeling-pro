/**
 * SCHED-WINDOW-1 · the scheduler and the crew load a window of days, never all of history.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { shiftWindow, requestedWindow, defaultWindow, MAX_WINDOW_DAYS } from '../src/lib/records/shift-window.ts';

describe('SCHED-WINDOW-1 · the window rule (core)', () => {
    test('planner: the weeks on screen ± one week', () => {
        assert.deepEqual(shiftWindow({ kind: 'planner', weekStart: '2026-10-05', weeks: 1 }, '2026-10-10'), { from: '2026-09-28', to: '2026-10-18' });
        assert.deepEqual(shiftWindow({ kind: 'planner', weekStart: '2026-10-05', weeks: 2 }, '2026-10-10'), { from: '2026-09-28', to: '2026-10-25' });
    });
    test('planner across a year change and the October DST weekend (pure calendar days)', () => {
        assert.deepEqual(shiftWindow({ kind: 'planner', weekStart: '2026-12-28', weeks: 1 }, '2026-12-30'), { from: '2026-12-21', to: '2027-01-10' });
        assert.deepEqual(shiftWindow({ kind: 'planner', weekStart: '2026-10-19', weeks: 1 }, '2026-10-25'), { from: '2026-10-12', to: '2026-11-01' });
    });
    test('crew covers MySchedule (−7 … +14), yesterday\'s night shift and four weeks ahead', () => {
        assert.deepEqual(shiftWindow({ kind: 'crew' }, '2026-03-01'), { from: '2026-02-21', to: '2026-03-29' });
    });
    test('late entry: the last 31 days up to today', () => {
        assert.deepEqual(shiftWindow({ kind: 'late-entry' }, '2026-10-10'), { from: '2026-09-09', to: '2026-10-10' });
    });
});

describe('SCHED-WINDOW-1 · the door\'s range', () => {
    test('no range → the bounded default, never all of history', () => {
        const r = requestedWindow(null, null, '2026-10-10');
        assert.deepEqual(r, { ok: true, window: defaultWindow('2026-10-10') });
        assert.deepEqual(defaultWindow('2026-10-10'), { from: '2026-09-09', to: '2027-01-08' });
    });
    test('a malformed range is refused', () => {
        for (const [f, t] of [['2026-10-01', null], [null, '2026-10-01'], ['2026-13-01', '2026-10-01'], ['2026-10-01T00:00:00Z', '2026-10-02'], ['banana', 'x'], ['2026-10-10', '2026-10-01']] as const) {
            assert.equal(requestedWindow(f, t, '2026-10-10').ok, false, `${f}…${t}`);
        }
    });
    test(`a range wider than ${MAX_WINDOW_DAYS} days is refused`, () => {
        assert.equal(requestedWindow('2020-01-01', '2026-10-10', '2026-10-10').ok, false);
        assert.equal(requestedWindow('2026-01-01', '2026-12-31', '2026-10-10').ok, true);
    });
});

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
}

describe('SCHED-WINDOW-1 · census', () => {
    test('every list of shifts asks for a range; the route applies it', () => {
        const unbounded = sources('src').flatMap(f => {
            const src = readFileSync(f, 'utf8');
            return (src.match(/hrList<[^>]*>\('(?:shifts|scheduled-shifts)'\s*\)|hrList\('(?:shifts|scheduled-shifts)'\s*\)/g) ?? []).map(m => `${f}: ${m}`);
        });
        assert.deepEqual(unbounded, []);
        const route = readFileSync('src/app/api/hr/[entity]/route.ts', 'utf8');
        assert.match(route, /requestedWindow\(url\.searchParams\.get\('from'\), url\.searchParams\.get\('to'\)/);
        assert.match(route, /where\.shiftDate = \{ gte: from, lte: to \}/);
    });
    test('every caller of useScheduledShifts names its surface', () => {
        const bare = sources('src').filter(f => /useScheduledShifts\(\s*\)/.test(readFileSync(f, 'utf8')));
        assert.deepEqual(bare, []);
    });
});
