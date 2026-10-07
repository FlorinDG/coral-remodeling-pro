import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineNet, lineProperties, purchaseLineBlocks } from '../src/lib/records/purchase-lines.ts';

test('a line keeps the GROSS price and the discount; the total is net (throw proof: only the net price kept)', () => {
    assert.equal(lineNet(2, 40, 17.35), 66.12);
    const p = lineProperties({ description: 'Magnacryl', quantity: 2, grossUnitPrice: 40, discountPercent: 17.35, vatRate: 21, lineTotal: 66.12, articleCode: '110963' });
    assert.deepEqual(p, { quantity: 2, unitCode: 'C62', unitPrice: 40, discountPct: 17.35, vatRate: 21, lineTotal: 66.12, articleCode: '110963', margePercent: 0 });
});

test('a discount not stated but visible in the numbers is derived; none when the price is already net', () => {
    assert.equal(lineProperties({ quantity: 2, unitPrice: 40, lineTotal: 66.12 }).discountPct, 17.35);
    assert.equal(lineProperties({ quantity: 2, unitPrice: 33.06, lineTotal: 66.12 }).discountPct, 0);
    assert.equal(lineProperties({ quantity: 3, unitPrice: 10 }).lineTotal, 30);   // no total read → computed
});

test('the read lines become rows (the scan stored them as text only)', () => {
    let n = 0;
    const rows = purchaseLineBlocks([{ description: 'A', quantity: 1, unitPrice: 5 }, { description: 'B' }], () => `r${++n}`);
    assert.deepEqual(rows.map(r => [r.id, r.type, r.content, r.order]), [['r1', 'financial-row', 'A', 0], ['r2', 'financial-row', 'B', 1]]);
    assert.deepEqual(purchaseLineBlocks(null, () => 'x'), []);
});
