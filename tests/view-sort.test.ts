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

// Florin 2026-10-08: "add the added option to sorts in db" — the record's own dates, not a field
import { SORT_ADDED, SORT_EDITED } from '../src/lib/records/view-sort.ts';

test('sort by "Toegevoegd": the record\'s creation moment, oldest first or newest first', () => {
    const pages = [
        { id: 'b', createdAt: '2026-10-02T09:00:00Z', properties: {} },
        { id: 'a', createdAt: '2026-10-01T09:00:00Z', properties: {} },
        { id: 'c', createdAt: '2026-10-03T09:00:00Z', properties: {} },
    ];
    const far = Date.parse('2026-12-01T00:00:00Z');   // none of them "recent"
    assert.deepEqual(sortPages(pages, [{ propertyId: SORT_ADDED, direction: 'ascending' }], far).map(p => p.id), ['a', 'b', 'c']);
    assert.deepEqual(sortPages(pages, [{ propertyId: SORT_ADDED, direction: 'descending' }], far).map(p => p.id), ['c', 'b', 'a']);
});

test('sort by "Gewijzigd": the last change, a record never changed sorts as empty', () => {
    const pages = [
        { id: 'old', createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', properties: {} },
        { id: 'new', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-05T09:00:00Z', properties: {} },
        { id: 'none', createdAt: '2026-10-01T07:00:00Z', properties: {} },
    ];
    const far = Date.parse('2026-12-01T00:00:00Z');
    assert.deepEqual(sortPages(pages, [{ propertyId: SORT_EDITED, direction: 'descending' }], far).map(p => p.id), ['none', 'new', 'old']);
    assert.deepEqual(sortPages(pages, [{ propertyId: SORT_EDITED, direction: 'ascending' }], far).map(p => p.id), ['old', 'new', 'none']);
});
