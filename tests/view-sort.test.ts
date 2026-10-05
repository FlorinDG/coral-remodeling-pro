import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortPages, holdOrder } from '../src/lib/records/view-sort.ts';

const now = Date.parse('2026-10-05T12:00:00Z');
const p = (id: string, createdAt: string, properties: Record<string, unknown> = {}) => ({ id, createdAt, properties });

test('recent rows on top (newest first), then the view\'s sorts; empties last ascending; numbers and text naturally', () => {
    const pages = [
        p('a', '2026-10-01T00:00:00Z', { n: '10' }), p('b', '2026-10-02T00:00:00Z', { n: '2' }),
        p('c', '2026-10-03T00:00:00Z', { n: '' }), p('d', '2026-10-05T11:59:30Z', { n: '1' }),
        p('e', '2026-10-04T00:00:00Z', { n: '1,5' }),
    ];
    assert.deepEqual(sortPages(pages, [{ propertyId: 'n', direction: 'ascending' }], now).map(x => x.id), ['d', 'e', 'b', 'a', 'c']);
    assert.deepEqual(sortPages(pages, [], now).map(x => x.id), ['d', 'e', 'c', 'b', 'a']);
    assert.deepEqual(sortPages([p('x', '2026-10-01T00:00:00Z', { t: 'item 10' }), p('y', '2026-10-01T00:00:00Z', { t: 'Item 2' })], [{ propertyId: 't', direction: 'ascending' }], now).map(x => x.id), ['y', 'x']);
});

test('while editing, rows hold their place; new rows join at the end; gone rows leave (throw proof: re-sort on edit)', () => {
    const sorted = [p('b', 'x'), p('a', 'x'), p('n', 'x')];
    assert.deepEqual(holdOrder(['a', 'b', 'gone'], sorted).map(x => x.id), ['a', 'b', 'n']);
    assert.deepEqual(holdOrder(null, sorted).map(x => x.id), ['b', 'a', 'n']);
});
