import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundCents, lineGross, lineNet, lineDiscount, discountOf, splitDocumentDiscount, chargedLines, lineNetUnitPrice } from '../src/lib/records/document-lines.ts';
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

test('DOC-LINES-2 · mixed rates (Florin: "yes"): a line\'s own rate counts; reverse charge is the whole document at 0', () => {
    const blocks = [line({ verkoopPrice: 100, vatRateOverride: 21 }), line({ verkoopPrice: 100, vatRateOverride: 6 }), line({ verkoopPrice: 50, vatMedecontractant: true })];
    const t = calculateInvoiceTotals(blocks as never, { vatRegime: '21' });
    assert.deepEqual(t.vatBreakdown.map(v => [v.rate, v.base, v.vat]), [[21, 150, 31.5], [6, 100, 6]]);   // no rate → the document's
    const six = calculateInvoiceTotals(blocks as never, { vatRegime: '6' });
    assert.deepEqual(six.vatBreakdown.map(v => [v.rate, v.base, v.vat]), [[21, 100, 21], [6, 150, 9]]);
    const rc = calculateInvoiceTotals(blocks as never, { vatRegime: 'medecontractant' });
    assert.deepEqual(rc.vatBreakdown.map(v => [v.rate, v.base, v.vat, v.isMedecontractant]), [[0, 250, 0, true]]);
});

test('DOC-LINES-2 · the legacy vatRate on a line NEVER counts — issued documents keep their VAT (census 2026-10-09)', () => {
    // 2026-1: regime 21, lines carrying vatRate 6 from an old screen — the VAT must stay 21%
    const t = calculateInvoiceTotals([line({ verkoopPrice: 100, vatRate: 6 }), line({ verkoopPrice: 100, vatRate: 0, vatMedecontractant: true })] as never, { vatRegime: '21' });
    assert.deepEqual(t.vatBreakdown.map(v => [v.rate, v.base, v.vat]), [[21, 200, 42]]);
});

test('DOC-LINES-2 · "rounding then adding": a line is rounded at the line; the subtotal is the sum of printed lines', () => {
    assert.equal(roundCents(33.335), 33.34);           // Math.round(33.335 * 100) / 100 gives 33.33
    assert.equal(roundCents(-33.335), -33.34);
    assert.equal(roundCents(1.005), 1.01);
    const half = line({ verkoopPrice: 66.67, clientDiscount: { kind: 'pct', value: 50 } });
    assert.equal(lineDiscount(half), 33.34);             // the discount is rounded at the line …
    assert.equal(lineNet(half), 33.33);                 // … and the line is what remains: 66.67 − 33.34
    const t = calculateInvoiceTotals([half, line({ verkoopPrice: 66.67, clientDiscount: { kind: 'pct', value: 50 } })] as never, { vatRegime: '0' });
    assert.equal(t.subtotal, 66.66);                    // 33.33 + 33.33 — not round(33.335 × 2) = 66.67
});

test('DOC-LINES-2 · "la somme des arrondis": each line\'s VAT rounded, then added per rate (4 × 2.25 at 21% → 1.88, not 1.89)', () => {
    const t = calculateInvoiceTotals([1, 2, 3, 4].map(() => line({ verkoopPrice: 2.25 })) as never, { vatRegime: '21' });
    assert.equal(t.subtotal, 9);
    assert.equal(t.totalVAT, 1.88);
    assert.equal(t.totalInclVAT, 10.88);
});

test('DOC-LINES-2 · discount on the total over mixed rates: split by base, each share takes its own VAT off', () => {
    const blocks = [line({ verkoopPrice: 300, vatRateOverride: 21 }), line({ verkoopPrice: 100, vatRateOverride: 6 })];
    const t = calculateInvoiceTotals(blocks as never, { vatRegime: '21', documentDiscount: { kind: 'pct', value: 10 } });
    assert.deepEqual(t.vatBreakdown.map(v => [v.rate, v.base, v.vat]), [[21, 270, 56.7], [6, 90, 5.4]]);
    assert.equal(t.documentDiscount, 40);
    assert.equal(t.totalInclVAT, 422.1);
});

test('DOC-LINES-2 · prices incl. VAT: the line\'s base rounded, its VAT the rest — the incl. total is what was typed', () => {
    const t = calculateInvoiceTotals([line({ verkoopPrice: 10 }), line({ verkoopPrice: 10 }), line({ verkoopPrice: 10 })] as never, { vatRegime: '21', vatIncluded: true });
    assert.equal(t.subtotal, 24.78);                    // 8.26 × 3
    assert.equal(t.totalInclVAT, 30);
});

test('DOC-LINES-2 · the mobile quick invoice writes the editor\'s line shape and takes its totals from the rule', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/app/[locale]/m/invoices/new/page.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /properties:\s*\{\s*description/);          // the values belong ON the block
    assert.doesNotMatch(src, /toISOString\(\)/);                          // the business day, never the UTC day
    assert.match(src, /calculateInvoiceTotals\(lineBlocks/);
    assert.doesNotMatch(src, /l\.unitPrice \* l\.vatRate/);               // no own VAT arithmetic
});

test('"Discount on total — [percentage]": the % set, or a fixed amount\'s share of the lines', async () => {
    const { documentDiscountPercent, formatPercent } = await import('../src/lib/invoice-totals.ts');
    const blocks = [line({ verkoopPrice: 400 })] as never;
    const pct = { kind: 'pct' as const, value: 12.5 };
    assert.equal(documentDiscountPercent(calculateInvoiceTotals(blocks, { documentDiscount: pct }), pct), 12.5);
    const fixed = { kind: 'amount' as const, value: 50 };
    assert.equal(documentDiscountPercent(calculateInvoiceTotals(blocks, { documentDiscount: fixed }), fixed), 12.5);
    assert.equal(documentDiscountPercent(calculateInvoiceTotals(blocks, {}), null), null);
    assert.equal(formatPercent(12.5, 'nl'), '12,5%');
    assert.equal(formatPercent(12.5, 'en'), '12.5%');
});
