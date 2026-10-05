import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCellInput, cellText, cellChanged, isTextEditable } from '../src/lib/records/grid-cell.ts';

const num = { id: 'n', type: 'number' }, txt = { id: 't', type: 'text' };
const sel = { id: 's', type: 'select', config: { options: [{ id: 'o1', name: 'Open' }] } };

test('typing a number: "1,5" and "1.5" are 1.5; empty is null; letters refuse (no silent 0)', () => {
    assert.deepEqual(parseCellInput(num, '1,5'), { ok: true, value: 1.5 });
    assert.deepEqual(parseCellInput(num, ' 1 250,75 '), { ok: true, value: 1250.75 });
    assert.deepEqual(parseCellInput(num, ''), { ok: true, value: null });
    assert.deepEqual(parseCellInput(num, 'abc'), { ok: false, reason: 'not_a_number' });
    assert.deepEqual(parseCellInput(txt, '  as typed '), { ok: true, value: '  as typed ' });
});

test('what a cell shows: option names, relation titles, comma decimals, ✓', () => {
    assert.equal(cellText(sel, 'o1'), 'Open');
    assert.equal(cellText(num, 1.5), '1,5');
    assert.equal(cellText({ id: 'c', type: 'checkbox' }, true), '✓');
    assert.equal(cellText({ id: 'r', type: 'relation' }, ['p1', 'p2'], id => (id === 'p1' ? 'Proj A' : null)), 'Proj A, …');
    assert.equal(cellText(txt, undefined), '');
});

test('no change = no write; phase-1 editable types', () => {
    assert.equal(cellChanged('', undefined), false);
    assert.equal(cellChanged('a', 'a'), false);
    assert.equal(cellChanged(1, 1.5), true);
    assert.equal(isTextEditable({ id: 'title', type: 'text' }), true);
    assert.equal(isTextEditable(sel), false);
});

import { toggleOption } from '../src/lib/records/grid-cell.ts';

test('multi-select toggling, and an unchanged list is no write (throw proof: reference compare would write)', () => {
    assert.deepEqual(toggleOption(['a', 'b'], 'b'), ['a']);
    assert.deepEqual(toggleOption('a', 'c'), ['a', 'c']);
    assert.deepEqual(toggleOption(undefined, 'x'), ['x']);
    assert.equal(cellChanged(['a', 'b'], ['a', 'b']), false);
    assert.equal(cellChanged([], undefined), false);
    assert.equal(cellChanged(['a'], ['b']), true);
    assert.deepEqual(parseCellInput({ id: 'c', type: 'currency' }, '1 250,5'), { ok: true, value: 1250.5 });
    assert.equal(cellText({ id: 'd', type: 'date' }, '2026-10-05'), '5 Oct 2026');
});
