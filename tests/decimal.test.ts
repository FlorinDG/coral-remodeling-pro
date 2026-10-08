import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecimal, formatDecimalInput } from '../src/lib/records/decimal.ts';
import { parseCellInput } from '../src/lib/records/number-cell.ts';

test('Florin 2026-10-08: a point and a comma both mean the decimal', () => {
    assert.equal(parseDecimal('12.5'), 12.5);
    assert.equal(parseDecimal('12,5'), 12.5);
    assert.equal(parseDecimal('12,50'), 12.5);
});

test('thousands, either way, and with a euro sign or spaces', () => {
    assert.equal(parseDecimal('1.234,56'), 1234.56);
    assert.equal(parseDecimal('1,234.56'), 1234.56);
    assert.equal(parseDecimal('€ 1 234,56'), 1234.56);
    assert.equal(parseDecimal('-3,5'), -3.5);
    assert.equal(parseDecimal('21%'), 21);
});

test('nothing typed, or no number, is null — never 0', () => {
    assert.equal(parseDecimal(''), null);
    assert.equal(parseDecimal('abc'), null);
    assert.equal(parseDecimal(undefined), null);
    assert.equal(parseDecimal(7), 7);
});

test('editing shows the Belgian comma, without trailing zeros', () => {
    assert.equal(formatDecimalInput(12.5), '12,5');
    assert.equal(formatDecimalInput(1234.567), '1234,57');
    assert.equal(formatDecimalInput(3), '3');
    assert.equal(formatDecimalInput(null), '');
});

test('the grid reads typed numbers by the same rule ("1.234,56" was no number there)', () => {
    assert.equal(parseCellInput('1.234,56'), 1234.56);
    assert.equal(parseCellInput('12.5'), 12.5);
    assert.equal(parseCellInput(''), null);
});
