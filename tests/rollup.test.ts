import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectRollup, applyRollupAggregation, locatorOf } from '../src/lib/records/rollup.ts';

const locate = locatorOf([
    { id: 'db-c', pages: [{ id: 'c1', properties: { town: 'Gent', phone: '09 12' } }, { id: 'c2', properties: { town: '' } }] },
    { id: 'db-x', pages: [{ id: 'x1', properties: { amount: '10,5' } }, { id: 'x2', properties: { amount: '4.5' } }] },
]);

test('the related records\' field, empties and unknown records skipped', () => {
    assert.deepEqual(collectRollup(['c1', 'c2', 'nope'], locate, 'town'), [{ value: 'Gent', targetDbId: 'db-c', targetPageId: 'c1' }]);
    assert.deepEqual(collectRollup('c1', locate, 'town'), []);
});

test('aggregations unchanged: sum / average / count / extract numbers', () => {
    const r = collectRollup(['x1', 'x2'], locate, 'amount');
    assert.equal(applyRollupAggregation(r, 'count')[0].value, '2');
    assert.equal(applyRollupAggregation([{ value: '10' }, { value: '4.5' }], 'sum')[0].value, '14.5');
    assert.equal(applyRollupAggregation([{ value: '10' }, { value: '5' }], 'average')[0].value, '7.5');
    assert.deepEqual(applyRollupAggregation([{ value: 'tel 09 12' }], 'extract_numbers').map(x => x.value), ['0912']);
    assert.deepEqual(applyRollupAggregation([], 'sum'), []);
});

test('sum / average read Belgian decimals and currency (throw proof: "10,5" was summed as 105)', () => {
    assert.equal(applyRollupAggregation([{ value: '10,5' }, { value: '4.5' }], 'sum')[0].value, '15');
    assert.equal(applyRollupAggregation([{ value: '€ 1 250,75' }, { value: '€ 0,25' }], 'sum')[0].value, '1251');
    assert.equal(applyRollupAggregation([{ value: '10,5' }, { value: '9,5' }], 'average')[0].value, '10');
});
