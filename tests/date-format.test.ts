import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    WEEK_STARTS_ON,
    formatDate,
    formatDateTime,
    formatDateLong,
    formatTime,
    formatDayMonth,
    formatWeekdayDayMonth,
    resolveLocale,
    DEFAULT_LOCALE,
} from '../src/lib/format/date.ts';

test('LOC-1: WEEK_STARTS_ON is Monday (1)', () => {
    assert.equal(WEEK_STARTS_ON, 1);
});

test('LOC-1: resolveLocale defaults to nl-BE and never returns en-US', () => {
    assert.equal(resolveLocale(null), DEFAULT_LOCALE);
    assert.equal(resolveLocale(undefined), DEFAULT_LOCALE);
    assert.equal(resolveLocale(''), DEFAULT_LOCALE);
    assert.equal(resolveLocale('nl'), 'nl-BE');
    assert.equal(resolveLocale('fr'), 'fr-BE');
    assert.equal(resolveLocale('en'), 'en-GB');
    assert.equal(resolveLocale('en-US'), 'en-GB'); // strictly prohibited from returning en-US
    assert.equal(resolveLocale('ro'), 'ro-RO');
});

test('LOC-1: formatDate returns DD/MM/YYYY European format', () => {
    // 9 December 2026: In Belgium DD/MM/YYYY is 09/12/2026 (never US 12/09/2026)
    assert.equal(formatDate('2026-12-09'), '09/12/2026');
    assert.equal(formatDate('2026-01-05'), '05/01/2026');
    assert.equal(formatDate('2026-09-18'), '18/09/2026');
});

test('LOC-1: formatDate handles Date instances', () => {
    const d = new Date(2026, 8, 18); // Sep 18, 2026
    assert.equal(formatDate(d), '18/09/2026');
});

test('LOC-1: formatDate handles empty, null, undefined, invalid', () => {
    assert.equal(formatDate(null), '');
    assert.equal(formatDate(undefined), '');
    assert.equal(formatDate(''), '');
    assert.equal(formatDate('invalid-date'), '');
});

test('LOC-1: formatDateTime returns DD/MM/YYYY HH:mm', () => {
    const d = new Date(2026, 8, 18, 14, 35);
    assert.equal(formatDateTime(d), '18/09/2026 14:35');
    assert.equal(formatDateTime(null), '');
});

test('LOC-1: formatDateLong formats month name', () => {
    const d = new Date(2026, 8, 18); // Sep 18, 2026
    const formattedNl = formatDateLong(d, 'nl');
    assert.match(formattedNl, /18/);
    assert.match(formattedNl, /2026/);
    assert.match(formattedNl, /september/i);
});

test('WH-UI-1: formatTime returns 24h format and never AM/PM', () => {
    assert.equal(formatTime('13:00'), '13:00');
    assert.equal(formatTime('13:00:00'), '13:00');
    assert.equal(formatTime('00:00'), '00:00');
    assert.equal(formatTime('12:00'), '12:00');
    assert.equal(formatTime('9:05'), '09:05');
    assert.equal(formatTime(new Date(2026, 8, 28, 9, 5)), '09:05');
    assert.equal(formatTime(new Date(2026, 8, 28, 13, 0)), '13:00');
    assert.equal(formatTime(null), '');
    assert.equal(formatTime(undefined), '');
    assert.equal(formatTime(''), '');

    // Assert NEVER AM/PM in any output
    const allHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:30`);
    for (const h of allHours) {
        const result = formatTime(h);
        assert.doesNotMatch(result, /AM|PM/i, `formatTime(${h}) must not contain AM/PM`);
        assert.match(result, /^\d{2}:\d{2}$/, `formatTime(${h}) must match HH:mm`);
    }
});

test('WH-2: formatDayMonth is day-first, no year, never US order', () => {
    const d = new Date(2026, 7, 7); // 7 Aug 2026, local
    const nl = formatDayMonth(d, 'nl');
    assert.match(nl, /^7\s/);            // day first
    assert.doesNotMatch(nl, /2026/);      // no year
    assert.match(formatDayMonth(d, 'en'), /^7\s/);   // en-GB, not 'Aug 7'
    assert.match(formatDayMonth('2026-08-07', 'fr'), /^7\s/); // plain YYYY-MM-DD parsed as local date
    assert.equal(formatDayMonth(null), '');
});

test('WH-2: formatWeekdayDayMonth puts the day before the month in every crew locale', () => {
    const d = new Date(2026, 8, 24); // Thu 24 Sep 2026, local
    for (const loc of ['nl', 'fr', 'en', 'ro', 'ru']) {
        const out = formatWeekdayDayMonth(d, loc);
        const day = out.search(/24/);
        assert.ok(day > 0, `${loc}: '${out}' has a weekday before the day`);
        assert.doesNotMatch(out, /2026/, `${loc}: no year unless asked`);
    }
    assert.match(formatWeekdayDayMonth(d, 'nl', true), /2026/);
});
