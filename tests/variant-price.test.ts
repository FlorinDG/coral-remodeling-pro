import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantDelta, lineVariantDelta } from '../src/lib/records/variant-price.ts';

const axes = [
    { id: 'kleur', options: [{ id: 'wit', priceDelta: 0 }, { id: 'zwart', priceDelta: 4.5 }] },
    { id: 'maat', options: [{ id: 'l', priceDelta: 10 }, { id: 'xl', priceDelta: 12.1 }] },
];

test('the surcharge of a selection sums its options (computed once, at selection)', () => {
    assert.equal(variantDelta({ kleur: 'zwart', maat: 'xl' }, axes), 16.6);
    assert.equal(variantDelta({ kleur: 'wit' }, axes), 0);
    assert.equal(variantDelta({ kleur: 'gone' }, axes), 0);
    assert.equal(variantDelta(undefined, axes), 0);
});

test('a line reads ONLY its frozen surcharge — a line from before (none) stays 0, whatever the library says now', () => {
    assert.equal(lineVariantDelta({ variantPriceDelta: 16.6 }), 16.6);
    assert.equal(lineVariantDelta({}), 0);
    assert.equal(lineVariantDelta({ variantPriceDelta: 'x' }), 0);
    assert.equal(lineVariantDelta(null), 0);
});
