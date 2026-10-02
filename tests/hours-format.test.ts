import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesToDecimalHours, formatDecimalHours, formatHoursMinutes } from '../src/lib/computeWorkedDuration.ts';

test('decimal hours from minutes, two places', () => {
    assert.equal(minutesToDecimalHours(450), 7.5);
    assert.equal(minutesToDecimalHours(440), 7.33);
    assert.equal(minutesToDecimalHours(445), 7.42);
    assert.equal(minutesToDecimalHours(0), 0);
});

test('a total is converted once from summed minutes — not the sum of rounded parts', () => {
    const parts = [20, 20, 20];                                   // 3 × 0.33 h would be 0.99
    assert.equal(minutesToDecimalHours(parts.reduce((a, b) => a + b, 0)), 1);
});

test('Belgian decimal comma, always two decimals', () => {
    assert.equal(formatDecimalHours(450, 'nl-BE'), '7,50');
    assert.equal(formatDecimalHours(480, 'en'), '8.00');
});

test('HH:mm, totals above 24 h', () => {
    assert.equal(formatHoursMinutes(450), '07:30');
    assert.equal(formatHoursMinutes(2250), '37:30');
    assert.equal(formatHoursMinutes(5), '00:05');
});
