import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellValue, parseCellInput } from '../src/components/admin/database/columns/numberCell.ts';

test('typed text is stored as a NUMBER — Belgian comma, spaces, empty, garbage', () => {
    assert.equal(parseCellInput('20'), 20);
    assert.equal(parseCellInput('12,5'), 12.5);
    assert.equal(parseCellInput(' 1 250,75 '), 1250.75);
    assert.equal(parseCellInput(''), null);
    assert.equal(parseCellInput('abc'), null);
    assert.equal(typeof parseCellInput('20'), 'number');
});

test('reading: a plain value as is; the legacy { [propertyId]: v } the old cell stored is unwrapped', () => {
    assert.equal(cellValue(20, 'prop-art-remise'), 20);
    assert.equal(cellValue({ 'prop-art-remise': 20 }, 'prop-art-remise'), 20);
    assert.equal(cellValue(null, 'p'), null);
    assert.deepEqual(cellValue({ other: 1 }, 'p'), { other: 1 });   // not ours — left alone
});
