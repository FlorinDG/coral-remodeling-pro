import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    WEEK_STARTS_ON,
    formatDate,
    formatDateTime,
    formatDateLong,
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
