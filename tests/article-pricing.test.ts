import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricingPropId, pricingValue } from '../src/lib/article-pricing.ts';

// The live articles schema, in Florin's order (screenshot 2026-10-02): LEVERANCIER comes BEFORE DISCOUNT.
const articles = [
    { id: 'prop-art-id', name: 'ID', type: 'text' },
    { id: 'prop-art-supplier', name: 'Leverancier', type: 'relation' },
    { id: 'prop-art-bruto', name: 'BruttoKost', type: 'currency' },
    { id: 'prop-art-remise', name: 'Discount', type: 'percent' },
    { id: 'prop-art-netto', name: 'NettoKost', type: 'formula' },
    { id: 'prop-art-margin', name: 'Marge Standard', type: 'percent' },
    { id: 'prop-art-margin-euro', name: 'Marge€', type: 'formula' },
    { id: 'prop-art-unit', name: 'Eeh', type: 'select' },
];

test('articles: the discount is the Discount field — never the LEVERANCIER relation', () => {
    assert.equal(pricingPropId(articles, 'discount'), 'prop-art-remise');
    const props = { 'prop-art-supplier': ['sup-1'], 'prop-art-bruto': 6, 'prop-art-remise': 20, 'prop-art-margin': 250 };
    assert.equal(pricingValue(articles, props, 'discount'), 20);
    assert.equal(pricingValue(articles, props, 'bruto'), 6);
    assert.equal(pricingValue(articles, props, 'marge'), 250);
});

test('another database: typed name matching — a relation is never a price', () => {
    const other = [
        { id: 'a', name: 'Leverancier', type: 'relation' },
        { id: 'b', name: 'Lever.%', type: 'percent' },
        { id: 'c', name: 'Brutoprijs', type: 'currency' },
        { id: 'd', name: 'Eenheid', type: 'select' },
    ];
    assert.equal(pricingPropId(other, 'discount'), 'b');
    assert.equal(pricingPropId(other, 'bruto'), 'c');
    assert.equal(pricingPropId(other, 'unit'), 'd');
});

test('a relation whose NAME contains a keyword is skipped — only a field that can hold a number counts', () => {
    const s = [
        { id: 'rel', name: 'Korting leverancier', type: 'relation' },   // listed FIRST, matches "korting"
        { id: 'pct', name: 'Korting %', type: 'percent' },
    ];
    assert.equal(pricingPropId(s, 'discount'), 'pct');
});

test('the margin percentage wins over the margin amount (Marge Standard before Marge€)', () => {
    const s = [{ id: 'eur', name: 'Marge€', type: 'formula' }, { id: 'pct', name: 'Marge Standard', type: 'percent' }];
    assert.equal(pricingPropId(s, 'marge'), 'pct');
});

test('nothing that fits → null', () => {
    assert.equal(pricingPropId([{ id: 'x', name: 'Leverancier', type: 'relation' }], 'discount'), null);
});
