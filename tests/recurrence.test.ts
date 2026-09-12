import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseRecurrenceRule,
    getNextDueDate,
    getNextDueAfter,
} from '../src/components/admin/tasks/RecurrenceEngine.ts';
import type { RecurrenceRule } from '../src/components/admin/tasks/RecurrenceEngine.ts';

describe('RecurrenceEngine — TASK-M8 corrections', () => {

    test('R-1: 31 Jan monthly ×3 steps clamps to month-end and preserves anchor day', () => {
        const parsed = parseRecurrenceRule('every month');
        assert.equal(parsed.ok, true);
        const rule = parsed.rule;

        // Jan 31
        const start = new Date(2026, 0, 31, 10, 0, 0); // 2026-01-31 10:00

        // Step 1 -> Feb 28
        const step1 = getNextDueDate(rule, start);
        assert.equal(step1.getFullYear(), 2026);
        assert.equal(step1.getMonth(), 1); // February (0-indexed)
        assert.equal(step1.getDate(), 28); // 2026 is non-leap year

        // Step 2 -> Mar 31 (anchor day 31 preserved, NOT 28)
        const step2 = getNextDueDate(rule, step1);
        assert.equal(step2.getFullYear(), 2026);
        assert.equal(step2.getMonth(), 2); // March
        assert.equal(step2.getDate(), 31);

        // Step 3 -> Apr 30 (April has 30 days)
        const step3 = getNextDueDate(rule, step2);
        assert.equal(step3.getFullYear(), 2026);
        assert.equal(step3.getMonth(), 3); // April
        assert.equal(step3.getDate(), 30);
    });

    test('R-2: 29 Feb yearly into a non-leap year clamps to 28 Feb and preserves leap anchor', () => {
        const parsed = parseRecurrenceRule('every year');
        assert.equal(parsed.ok, true);
        const rule = parsed.rule;

        // Leap year 2024-02-29
        const leapDate = new Date(2024, 1, 29, 9, 0, 0);

        // Non-leap year 2025 -> Feb 28 (NOT Mar 1)
        const step1 = getNextDueDate(rule, leapDate);
        assert.equal(step1.getFullYear(), 2025);
        assert.equal(step1.getMonth(), 1);
        assert.equal(step1.getDate(), 28);

        // Non-leap year 2026 -> Feb 28
        const step2 = getNextDueDate(rule, step1);
        assert.equal(step2.getFullYear(), 2026);
        assert.equal(step2.getMonth(), 1);
        assert.equal(step2.getDate(), 28);

        // Advance into next leap year 2028 with 2-year interval or 2 steps
        const step3 = getNextDueDate(rule, step2); // 2027-02-28
        const step4 = getNextDueDate(rule, step3); // 2028-02-29 (leap year restored!)
        assert.equal(step4.getFullYear(), 2028);
        assert.equal(step4.getMonth(), 1);
        assert.equal(step4.getDate(), 29);
    });

    test('R-3: interval < 1 is rejected and assert throws in getNextDueDate', () => {
        // parse rejects 0 interval
        const zeroDays = parseRecurrenceRule('every 0 days');
        assert.equal(zeroDays.ok, false);
        if (!zeroDays.ok) {
            assert.match(zeroDays.reason, /Interval must be at least 1/i);
            assert.equal(zeroDays.raw, 'every 0 days');
        }

        const zeroWeeks = parseRecurrenceRule('every 0 weeks');
        assert.equal(zeroWeeks.ok, false);

        // getNextDueDate throws when interval < 1
        const invalidRule: RecurrenceRule = {
            pattern: 'daily',
            interval: 0,
            raw: 'invalid-zero',
        };
        assert.throws(() => {
            getNextDueDate(invalidRule, new Date());
        }, /Interval must be at least 1/);
    });

    test('R-4: every 2 weeks on Tuesday honours the interval', () => {
        const parsed = parseRecurrenceRule('every 2 weeks on tuesday');
        assert.equal(parsed.ok, true);
        assert.equal(parsed.pattern, 'weekly');
        assert.equal(parsed.interval, 2);
        assert.equal(parsed.dayOfWeek, 2); // Tuesday = 2

        // Tuesday 2026-09-08
        const tuesday1 = new Date(2026, 8, 8, 14, 0, 0); // Month 8 is September
        assert.equal(tuesday1.getDay(), 2);

        // Next occurrence is +14 days on Tuesday
        const tuesday2 = getNextDueDate(parsed, tuesday1);
        assert.equal(tuesday2.getFullYear(), 2026);
        assert.equal(tuesday2.getMonth(), 8);
        assert.equal(tuesday2.getDate(), 22);
        assert.equal(tuesday2.getDay(), 2);

        // Next after that is +14 days on Tuesday (Oct 6)
        const tuesday3 = getNextDueDate(parsed, tuesday2);
        assert.equal(tuesday3.getFullYear(), 2026);
        assert.equal(tuesday3.getMonth(), 9); // October
        assert.equal(tuesday3.getDate(), 6);
        assert.equal(tuesday3.getDay(), 2);
    });

    test('R-5: getNextDueAfter catches up ten missed days without spinning', () => {
        const parsed = parseRecurrenceRule('every day');
        assert.equal(parsed.ok, true);

        // Due on Jan 1
        const jan1 = new Date(2026, 0, 1, 9, 0, 0);
        // Current date is Jan 11 (10 days later)
        const jan11 = new Date(2026, 0, 11, 9, 0, 0);

        const caughtUp = getNextDueAfter(parsed, jan1, jan11);
        // First occurrence strictly after Jan 11 is Jan 12
        assert.equal(caughtUp.getFullYear(), 2026);
        assert.equal(caughtUp.getMonth(), 0);
        assert.equal(caughtUp.getDate(), 12);
        assert.ok(caughtUp > jan11);
    });

    test('R-6: unparseable input returns a reported failure, not null', () => {
        const dutchInput = parseRecurrenceRule('elke maand');
        assert.notEqual(dutchInput, null);
        assert.equal(dutchInput.ok, false);
        if (!dutchInput.ok) {
            assert.match(dutchInput.reason, /Unrecognized recurrence pattern/);
            assert.equal(dutchInput.raw, 'elke maand');
        }

        const frenchInput = parseRecurrenceRule('chaque semaine');
        assert.notEqual(frenchInput, null);
        assert.equal(frenchInput.ok, false);
        if (!frenchInput.ok) {
            assert.equal(frenchInput.raw, 'chaque semaine');
        }

        const emptyInput = parseRecurrenceRule('');
        assert.notEqual(emptyInput, null);
        assert.equal(emptyInput.ok, false);
    });

    test('DST boundary in Europe/Brussels does not shift the calendar day', () => {
        const parsed = parseRecurrenceRule('daily');
        assert.equal(parsed.ok, true);

        // Brussels Spring DST transition: Sunday 29 March 2026 (02:00 -> 03:00)
        const march28 = new Date(2026, 2, 28, 9, 0, 0);
        const march29 = getNextDueDate(parsed, march28);
        assert.equal(march29.getDate(), 29);
        assert.equal(march29.getMonth(), 2);
        assert.equal(march29.getHours(), 9);

        const march30 = getNextDueDate(parsed, march29);
        assert.equal(march30.getDate(), 30);
        assert.equal(march30.getMonth(), 2);
        assert.equal(march30.getHours(), 9);

        // Brussels Autumn DST transition: Sunday 25 October 2026 (03:00 -> 02:00)
        const oct24 = new Date(2026, 9, 24, 9, 0, 0);
        const oct25 = getNextDueDate(parsed, oct24);
        assert.equal(oct25.getDate(), 25);
        assert.equal(oct25.getMonth(), 9);
        assert.equal(oct25.getHours(), 9);

        const oct26 = getNextDueDate(parsed, oct25);
        assert.equal(oct26.getDate(), 26);
        assert.equal(oct26.getMonth(), 9);
        assert.equal(oct26.getHours(), 9);
    });

    test('Repeat-from mode: due date vs completion date', () => {
        const ruleDue = parseRecurrenceRule('every month');
        assert.equal(ruleDue.ok, true);

        const ruleCompletion = parseRecurrenceRule('every month after completion');
        assert.equal(ruleCompletion.ok, true);
        assert.equal(ruleCompletion.repeatFrom, 'completion');

        const dueDate = new Date(2026, 0, 20, 10, 0, 0);
        const completionDate = new Date(2026, 0, 27, 10, 0, 0);

        // Default: anchors to due date
        const nextDueFromDue = getNextDueDate(ruleDue, dueDate, { completionDate });
        assert.equal(nextDueFromDue.getMonth(), 1); // Feb
        assert.equal(nextDueFromDue.getDate(), 20);

        // Completion-anchored: anchors to when it was actually done
        const nextDueFromCompletion = getNextDueDate(ruleCompletion, dueDate, { completionDate });
        assert.equal(nextDueFromCompletion.getMonth(), 1); // Feb
        assert.equal(nextDueFromCompletion.getDate(), 27);
    });
});
