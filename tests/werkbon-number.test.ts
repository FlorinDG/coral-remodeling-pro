import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextWerkbonNumber, werkbonFileName } from '../src/lib/records/werkbon-number.ts';

test('the first of the year is 0001; then the next after the highest issued', () => {
    assert.equal(nextWerkbonNumber([], '2026'), 'WB-2026-0001');
    assert.equal(nextWerkbonNumber(['WB-2026-0001', 'WB-2026-0002'], '2026'), 'WB-2026-0003');
});

test('never reuses a number — gaps and order do not matter', () => {
    assert.equal(nextWerkbonNumber(['WB-2026-0007', 'WB-2026-0002'], '2026'), 'WB-2026-0008');
});

test('another year, noise and missing values are ignored; the sequence restarts each year', () => {
    assert.equal(nextWerkbonNumber(['WB-2025-0120', null, undefined, 'x', 'WB-2026-12a'], '2026'), 'WB-2026-0001');
    assert.equal(nextWerkbonNumber(['WB-2026-9999'], '2026'), 'WB-2026-10000');
});

test('file name: the localised word + number + date', () => {
    assert.equal(werkbonFileName('WB-2026-0003', '2026-10-04', 'nl'), 'Werkbon WB-2026-0003 2026-10-04.pdf');
    assert.equal(werkbonFileName('WB-2026-0003', '2026-10-04', 'fr'), 'Bon de travail WB-2026-0003 2026-10-04.pdf');
    assert.equal(werkbonFileName('WB-2026-0003', '2026-10-04', 'en'), 'Work order WB-2026-0003 2026-10-04.pdf');
});

import { isWerkbonFile } from '../src/lib/records/werkbon-number.ts';

test('the signed work order PDF is recognised by its name, in every language — nothing else is', () => {
    assert.equal(isWerkbonFile(werkbonFileName('WB-2026-0001', '2026-10-04', 'nl')), true);
    assert.equal(isWerkbonFile(werkbonFileName('WB-2026-0012', '2026-10-04', 'fr')), true);
    assert.equal(isWerkbonFile(werkbonFileName('WB-2026-0012', '2026-10-04', 'en')), true);
    assert.equal(isWerkbonFile('Handtekening — Jan.png'), false);
    assert.equal(isWerkbonFile('Werkbon notes.pdf'), false);
    assert.equal(isWerkbonFile(null), false);
});
