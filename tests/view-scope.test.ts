import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceKey, viewsForSurface, seedSurfaceView } from '../src/lib/records/view-scope.ts';

const views = [
    { id: 'v-all', name: 'Table', filters: [{ id: 'f1' }], sorts: [{ id: 's1' }] },
    { id: 'v-board', name: 'Board' },
    { id: 'v-cn', name: 'Table', surface: 'docType=opt-credit-note', filters: [{ id: 'f2' }] },
];

test('a screen lists only its own views — the credit-note screen never sees the invoice screen\'s filters', () => {
    assert.equal(surfaceKey({ propertyId: 'docType', value: 'opt-credit-note' }), 'docType=opt-credit-note');
    assert.equal(surfaceKey(undefined), null);
    assert.deepEqual(viewsForSurface(views, 'docType=opt-credit-note').map(v => v.id), ['v-cn']);
    assert.deepEqual(viewsForSurface(views, null).map(v => v.id), ['v-all', 'v-board']);
    assert.deepEqual(viewsForSurface(views, 'docType=opt-proforma'), []);
});

test('throw proof: a new screen starts from the base layout WITHOUT the base view\'s filters and sorts', () => {
    const seeded = seedSurfaceView(views, 'docType=opt-proforma', 'v-new')!;
    assert.equal(seeded.id, 'v-new');
    assert.equal(seeded.surface, 'docType=opt-proforma');
    assert.deepEqual(seeded.filters, []);
    assert.deepEqual(seeded.sorts, []);
    assert.equal((views[0].filters as unknown[]).length, 1);   // the base view is untouched
    assert.equal(seedSurfaceView([], 'x', 'y'), null);
});
