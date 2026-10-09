import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineGross, lineNet, lineDiscount, discountOf, splitDocumentDiscount, chargedLines, lineNetUnitPrice } from '../src/lib/records/document-lines.ts';
import { calculateInvoiceTotals } from '../src/lib/invoice-totals.ts';
import { calculateInvoiceTotals as oldTotals } from './_old-invoice-totals.ts';

const line = (p: Record<string, unknown>) => ({ type: 'line', quantity: 1, ...p });

test('without discounts the totals are EXACTLY what they were — sections, posts × quantity, subcomponents, variants, optional, incl. VAT', () => {
    const docs = [
        [line({ verkoopPrice: 10.333, quantity: 3 }), line({ unitPrice: 0.1, quantity: 7 })],
        [{ type: 'section', children: [line({ verkoopPrice: 99.99 }), line({ verkoopPrice: 5, isOptional: true })] },
         { type: 'post', quantity: 2, children: [line({ verkoopPrice: 12.5, quantity: 3 })] }],
        [line({ quantity: 2, children: [line({ verkoopPrice: 3.33, quantity: 3 }), line({ verkoopPrice: 1.11 })] }),
         line({ verkoopPrice: 40, variantPriceDelta: 7.5, quantity: 2 })],
        [],
    ];
    for (const blocks of docs) for (const opts of [{}, { vatRegime: '6' }, { vatRegime: 'medecontractant' }, { vatIncluded: true }]) {
        const now = calculateInvoiceTotals(blocks as never, opts);
        const before = oldTotals(blocks as never, opts);
        assert.deepEqual({ subtotal: now.subtotal, vatBreakdown: now.vatBreakdown, totalVAT: now.totalVAT, totalInclVAT: now.totalInclVAT, hasMedecontractant: now.hasMedecontractant }, before);
    }
});

test('Florin 2026-10-09: a line discount — a percentage or a fixed amount, never below zero', () => {
    assert.equal(lineNet(line({ verkoopPrice: 100, quantity: 2, clientDiscount: { kind: 'pct', value: 10 } })), 180);
    assert.equal(lineNet(line({ verkoopPrice: 100, quantity: 2, clientDiscount: { kind: 'amount', value: 25 } })), 175);
    assert.equal(lineNet(line({ verkoopPrice: 10, clientDiscount: { kind: 'amount', value: 50 } })), 0);
    assert.equal(lineDiscount(line({ verkoopPrice: 10, clientDiscount: { kind: 'pct', value: 150 } })), 10);   // max 100 %
    assert.equal(discountOf({ kind: 'pct', value: 0 }), null);
    assert.equal(discountOf({ kind: 'x', value: 5 }), null);
    assert.equal(lineNetUnitPrice(line({ verkoopPrice: 100, quantity: 4, clientDiscount: { kind: 'pct', value: 25 } })), 75);
});

test('a line with subcomponents is worth its subcomponents × its quantity; its discount comes off that', () => {
    const parent = line({ quantity: 2, clientDiscount: { kind: 'pct', value: 50 }, children: [line({ verkoopPrice: 10 }), line({ verkoopPrice: 5, quantity: 2 })] });
    assert.equal(lineGross(parent), 40);
    assert.equal(lineNet(parent), 20);
    assert.equal(chargedLines([parent]).length, 1);
});

test('the discount on the total: before VAT, a percentage or an amount, split over the VAT rates; the line discounts first', () => {
    const blocks = [line({ verkoopPrice: 100, clientDiscount: { kind: 'pct', value: 10 } }), line({ verkoopPrice: 50 })];
    const t = calculateInvoiceTotals(blocks as never, { documentDiscount: { kind: 'pct', value: 10 } });
    assert.equal(t.linesGross, 150);
    assert.equal(t.lineDiscounts, 10);
    assert.equal(t.linesNet, 140);
    assert.equal(t.documentDiscount, 14);
    assert.equal(t.subtotal, 126);
    assert.equal(t.totalVAT, 26.46);
    assert.equal(t.totalInclVAT, 152.46);
    const fixed = calculateInvoiceTotals(blocks as never, { documentDiscount: { kind: 'amount', value: 500 } });
    assert.equal(fixed.subtotal, 0);   // never below zero
    const split = splitDocumentDiscount(new Map([[21, 66.67], [6, 33.33]]), { kind: 'amount', value: 10 });
    assert.equal(split.total, 10);
    assert.equal([...split.byRate.values()].reduce((a, b) => a + b, 0), 10);   // the cents add up
});
