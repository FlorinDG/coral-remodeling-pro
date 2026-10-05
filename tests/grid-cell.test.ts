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

import { parseClipboardGrid, pasteValue } from '../src/lib/records/grid-cell.ts';

test('clipboard from Excel: tabs and lines, quoted cells with tabs / newlines / quotes', () => {
    assert.deepEqual(parseClipboardGrid('a\tb\r\nc\td\r\n'), [['a', 'b'], ['c', 'd']]);
    assert.deepEqual(parseClipboardGrid('"x\ty"\t"he said ""hi"""\n"two\nlines"\tz'), [['x\ty', 'he said "hi"'], ['two\nlines', 'z']]);
    assert.deepEqual(parseClipboardGrid('single'), [['single']]);
});

test('a pasted value per field — never a guess (throw proof: an unknown option name would be stored as text)', () => {
    const sel = { id: 's', type: 'select', config: { options: [{ id: 'o1', name: 'Open' }, { id: 'o2', name: 'Won' }] } };
    assert.deepEqual(pasteValue(sel, ' won '), { ok: true, value: 'o2' });
    assert.deepEqual(pasteValue(sel, 'Lost'), { ok: false, reason: 'unknown_option' });
    assert.deepEqual(pasteValue({ ...sel, type: 'multi_select' }, 'Open, Won'), { ok: true, value: ['o1', 'o2'] });
    assert.deepEqual(pasteValue({ id: 'c', type: 'checkbox' }, 'Ja'), { ok: true, value: true });
    assert.deepEqual(pasteValue({ id: 'd', type: 'date' }, '05/10/2026'), { ok: true, value: '2026-10-05' });
    assert.deepEqual(pasteValue({ id: 'd', type: 'date' }, 'soon'), { ok: false, reason: 'not_a_date' });
    assert.deepEqual(pasteValue({ id: 'n', type: 'number' }, '1 250,5'), { ok: true, value: 1250.5 });
    assert.deepEqual(pasteValue({ id: 'r', type: 'rollup' }, 'x'), { ok: false, reason: 'not_pastable' });
});

import { cellDisplay, parseCellInput as parseInput } from '../src/lib/records/grid-cell.ts';

test('display the Belgian way: € amounts, %, decimals, phones, timestamps on the business clock (throw proof: "1250.5")', () => {
    assert.equal(cellDisplay({ id: 'totalIncVat', type: 'currency' }, 1234.5), '€ 1.234,50');
    assert.equal(cellDisplay({ id: 'v', type: 'percent' }, 21), '21 %');
    assert.equal(cellDisplay({ id: 'n', type: 'number' }, 1250.5), '1.250,5');
    assert.equal(cellDisplay({ id: 'n', type: 'number' }, null), '');
    assert.equal(cellDisplay({ id: 'p', type: 'phone' }, '0470123456'), '0470 12 34 56');
    assert.equal(cellDisplay({ id: 'c', type: 'created_time' }, '2026-10-05T16:44:00.000Z'), '05/10/2026 18:44');
});

test('typing a phone writes it the Belgian way; a bad email is refused, never stored', () => {
    assert.deepEqual(parseInput({ id: 'p', type: 'phone' }, '+32470123456'), { ok: true, value: '+32 470 12 34 56' });
    assert.deepEqual(parseInput({ id: 'e', type: 'email' }, ' jan@coral-group.be '), { ok: true, value: 'jan@coral-group.be' });
    assert.deepEqual(parseInput({ id: 'e', type: 'email' }, 'jan@'), { ok: false, reason: 'not_an_email' });
});
