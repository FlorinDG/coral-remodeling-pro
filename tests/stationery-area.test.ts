import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentAreaFromRows, DEFAULT_AREA } from '../src/lib/documents/stationery-area.ts';

/** A page of 842 rows (1 row = 1pt) with ink on the given row ranges. */
function page(...inked: Array<[number, number]>): number[] {
    const rows = new Array(842).fill(0);
    for (const [a, b] of inked) for (let i = a; i < b; i++) rows[i] = 0.2;
    return rows;
}

test("Coral's letterhead: logo to ~125pt, footer from ~773pt → the content uses the band between (throw proof: the fixed 180 / 150)", () => {
    assert.deepEqual(contentAreaFromRows(page([30, 125], [773, 842])), { top: 139, bottom: 83 });
});

test('header only / footer only / none: the printer margin where there is no ink', () => {
    assert.deepEqual(contentAreaFromRows(page([0, 100])), { top: 114, bottom: 36 });
    assert.deepEqual(contentAreaFromRows(page([780, 842])), { top: 36, bottom: 76 });
    assert.deepEqual(contentAreaFromRows(page()), { top: 36, bottom: 36 });
});

test('a full-page design, or a watermark splitting the page: the fixed margins (never print over ink)', () => {
    assert.deepEqual(contentAreaFromRows(page([0, 842])), { ...DEFAULT_AREA });
    assert.deepEqual(contentAreaFromRows(page([0, 120], [400, 460], [760, 842])), { ...DEFAULT_AREA });   // largest band < 40%
    assert.deepEqual(contentAreaFromRows([]), { ...DEFAULT_AREA });
});

test('a faint row (below the ink threshold) does not cut the band', () => {
    const rows = page([30, 125], [773, 842]); rows[400] = 0.001;
    assert.deepEqual(contentAreaFromRows(rows), { top: 139, bottom: 83 });
});
