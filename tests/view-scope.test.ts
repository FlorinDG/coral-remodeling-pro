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

import { hiddenIn, schemaOrderFor } from '../src/lib/records/view-scope.ts';

test('decision A: which views hide a field; a view takes the schema order and keeps its hidden flags', () => {
    const vs = [
        { id: 'v1', name: 'Table', propertiesState: [{ propertyId: 'won', hidden: true }, { propertyId: 'date', hidden: false }] },
        { id: 'v2', name: 'Board', propertiesState: [{ propertyId: 'won', hidden: false }] },
        { id: 'v3', name: 'Calendar' },
    ];
    assert.deepEqual(hiddenIn(vs, 'won'), ['Table']);
    assert.deepEqual(hiddenIn(vs, 'date'), []);
    const st = schemaOrderFor({ id: 'v1', propertiesState: [{ propertyId: 'date', hidden: false, width: 120 }, { propertyId: 'won', hidden: true }] }, ['title', 'won', 'date']);
    assert.deepEqual(st.map(s => `${s.propertyId}:${s.order}:${s.hidden}`), ['title:0:false', 'won:1:true', 'date:2:false']);
    assert.equal(st[2].width, 120);
});

import { isHiddenInView } from '../src/lib/records/view-scope.ts';

test('the comments field starts hidden; a view that shows it shows it; other fields start visible', () => {
    assert.equal(isHiddenInView(undefined, { type: 'comments' }), true);
    assert.equal(isHiddenInView({ hidden: false }, { type: 'comments' }), false);
    assert.equal(isHiddenInView(undefined, { type: 'text' }), false);
    assert.equal(isHiddenInView({ hidden: true }, { type: 'text' }), true);
});

import { visibleColumns } from '../src/lib/records/view-scope.ts';

test('a view\'s columns: hidden out, the comments field only when shown, ordered by the view', () => {
    const props = [{ id: 'title', type: 'text' }, { id: 'a', type: 'text' }, { id: 'b', type: 'text' }, { id: 'comments', type: 'comments' }];
    assert.deepEqual(visibleColumns(props, [{ propertyId: 'b', order: 0 }, { propertyId: 'title', order: 1 }, { propertyId: 'a', hidden: true }]).map(p => p.id), ['b', 'title']);
    assert.deepEqual(visibleColumns(props, [{ propertyId: 'comments', hidden: false, order: 0 }]).map(p => p.id), ['comments', 'title', 'a', 'b']);
});

import { moveColumn, setColumnWidth } from '../src/lib/records/view-scope.ts';

test('moving a column re-orders the visible ones and keeps widths / hidden flags (throw proof: hidden ones lost)', () => {
    const st = [{ propertyId: 'title', order: 0, width: 260 }, { propertyId: 'a', order: 1 }, { propertyId: 'h', hidden: true, order: 2 }, { propertyId: 'b', order: 3 }];
    const next = moveColumn(st, ['title', 'a', 'b'], 'b', 'title');
    assert.deepEqual(next.map(s => s.propertyId), ['b', 'title', 'a', 'h']);
    assert.equal(next.find(s => s.propertyId === 'title')!.width, 260);
    assert.equal(next.find(s => s.propertyId === 'h')!.hidden, true);
    assert.deepEqual(next.map(s => s.order), [0, 1, 2, 3]);
});

test('a width is set per view, clamped', () => {
    assert.equal(setColumnWidth([], 'a', 20)[0].width, 60);
    assert.equal(setColumnWidth([{ propertyId: 'a', hidden: true }], 'a', 333.4)[0].width, 333);
    assert.equal(setColumnWidth([{ propertyId: 'a', hidden: true }], 'a', 333)[0].hidden, true);
});
