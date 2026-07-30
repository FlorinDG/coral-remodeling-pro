/**
 * CHARACTERIZATION TESTS — computeWorkedDuration
 *
 * These pin CURRENT behaviour, not desired behaviour. If one fails, either the
 * behaviour changed on purpose (update the test, deliberately) or something
 * regressed (fix the code). Do not "fix" a test to make it pass.
 *
 * Canonical break rule (src/lib/computeWorkedDuration.ts):
 *   worked > 4h AND noBreak === false  =>  deduct exactly 30 minutes
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeWorkedDuration, formatWorkDuration } from '../src/lib/computeWorkedDuration.ts';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 6, 1, h, m, 0));

describe('computeWorkedDuration — the break rule', () => {
    test('under 4h: no break deducted', () => {
        const d = computeWorkedDuration(at(8), at(11, 30), false);
        assert.equal(d.totalMinutes, 210);
        assert.equal(d.breakDeducted, false);
        assert.equal(d.hours, 3);
        assert.equal(d.minutes, 30);
    });

    test('exactly 4h: NOT deducted (rule is strictly greater than 4)', () => {
        const d = computeWorkedDuration(at(8), at(12), false);
        assert.equal(d.totalMinutes, 240);
        assert.equal(d.breakDeducted, false);
    });

    test('4h + 1min: deducted — this is the boundary', () => {
        const d = computeWorkedDuration(at(8), at(12, 1), false);
        assert.equal(d.totalMinutes, 241 - 30);
        assert.equal(d.breakDeducted, true);
    });

    test('8h shift: 30 min deducted', () => {
        const d = computeWorkedDuration(at(8), at(16), false);
        assert.equal(d.totalMinutes, 450); // 480 - 30
        assert.equal(d.hours, 7);
        assert.equal(d.minutes, 30);
        assert.equal(d.breakDeducted, true);
    });

    test('noBreak = true suppresses the deduction even on a long shift', () => {
        const d = computeWorkedDuration(at(8), at(16), true);
        assert.equal(d.totalMinutes, 480);
        assert.equal(d.breakDeducted, false);
    });
});

describe('computeWorkedDuration — edge cases that must not silently return wrong numbers', () => {
    test('missing clock-out returns zero, flagged as no break', () => {
        const d = computeWorkedDuration(at(8), null, false);
        assert.deepEqual(d, { hours: 0, minutes: 0, totalMinutes: 0, breakDeducted: false });
    });

    test('missing clock-in returns zero', () => {
        const d = computeWorkedDuration(null, at(16), false);
        assert.equal(d.totalMinutes, 0);
    });

    test('clock-out BEFORE clock-in returns zero (never negative)', () => {
        const d = computeWorkedDuration(at(16), at(8), false);
        assert.equal(d.totalMinutes, 0);
    });

    test('unparseable dates return zero rather than NaN', () => {
        const d = computeWorkedDuration('not-a-date', 'also-not', false);
        assert.equal(d.totalMinutes, 0);
        assert.ok(!Number.isNaN(d.totalMinutes));
    });

    test('accepts ISO strings as well as Date objects', () => {
        const a = computeWorkedDuration('2026-07-01T08:00:00.000Z', '2026-07-01T16:00:00.000Z', false);
        const b = computeWorkedDuration(at(8), at(16), false);
        assert.deepEqual(a, b);
    });

    test('seconds are floored, not rounded (59s does not become a minute)', () => {
        const start = new Date(Date.UTC(2026, 6, 1, 8, 0, 0));
        const end = new Date(Date.UTC(2026, 6, 1, 8, 30, 59));
        assert.equal(computeWorkedDuration(start, end, false).totalMinutes, 30);
    });
});

describe('formatWorkDuration', () => {
    test('zero renders as 0h', () => {
        assert.equal(formatWorkDuration({ hours: 0, minutes: 0, totalMinutes: 0, breakDeducted: false }), '0h');
    });
    test('whole hours omit minutes', () => {
        assert.equal(formatWorkDuration({ hours: 7, minutes: 0, totalMinutes: 420, breakDeducted: true }), '7h');
    });
    test('hours + minutes', () => {
        assert.equal(formatWorkDuration({ hours: 7, minutes: 30, totalMinutes: 450, breakDeducted: true }), '7h 30m');
    });
    test('under an hour shows minutes only', () => {
        assert.equal(formatWorkDuration({ hours: 0, minutes: 45, totalMinutes: 45, breakDeducted: false }), '45m');
    });
});
