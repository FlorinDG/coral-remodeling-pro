import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffDefinition, applyDefinitionOps, sameJson, type Definition } from '../src/lib/records/database-definition.ts';

const base: Definition = {
    name: 'CRM',
    properties: [
        { id: 'title', name: 'Name', type: 'text' },
        { id: 'status', name: 'Status', type: 'select', config: { options: [{ id: 'new', name: 'New' }] } },
        { id: 'won', name: 'Won', type: 'checkbox' },
    ],
    views: [
        { id: 'v1', name: 'Table', filters: [], propertiesState: [] },
        { id: 'v2', name: 'Board', filters: [] },
    ],
};
const clone = (d: Definition): Definition => JSON.parse(JSON.stringify(d));

test('nothing changed → no operation (no write at all)', () => {
    assert.deepEqual(diffDefinition(base, clone(base)), []);
});

test('round trip: applying the diff to the base gives exactly the edited definition', () => {
    const next = clone(base);
    next.properties[1].config = { options: [{ id: 'new', name: 'New' }, { id: 'lost', name: 'Lost' }] };
    next.properties.push({ id: 'p-town', name: 'Town', type: 'text' });
    next.properties = [next.properties[0], next.properties[2], next.properties[1], next.properties[3]];
    next.views[0].filters = [{ id: 'f1', propertyId: 'won', operator: 'is', value: true }];
    next.views = next.views.filter(v => v.id !== 'v2');
    next.name = 'Sales pipeline';
    const r = applyDefinitionOps(base, diffDefinition(base, next));
    assert.ok(sameJson(r.next, next), JSON.stringify(r.next));
    assert.deepEqual(r.refused, []);
    assert.deepEqual(r.changed, { properties: true, views: true, meta: true });
});

test('THE BUG: a screen with an OLD copy no longer undoes a newer schema edit (throw proof: whole-definition write)', () => {
    // Florin edits the Status options on the schema page — the server has them.
    const server = clone(base);
    server.properties[1].config = { options: [{ id: 'new', name: 'New' }, { id: 'won', name: 'Won' }] };
    // Another screen, still holding the OLD definition, adds a filter to its view.
    const stale = clone(base);
    const staleNext = clone(stale);
    staleNext.views[0].filters = [{ id: 'f9', propertyId: 'won', operator: 'is', value: true }];
    const r = applyDefinitionOps(server, diffDefinition(stale, staleNext));
    // the filter landed AND the schema edit survived
    assert.equal((r.next.views[0].filters as unknown[]).length, 1);
    assert.equal(((r.next.properties[1].config as { options: unknown[] }).options).length, 2);
    assert.equal(r.changed.properties, false);   // the stale screen wrote no field at all
    // what the old door did (write the whole stale definition) loses the edit — the reason this module exists
    assert.equal(((staleNext.properties[1].config as { options: unknown[] }).options).length, 1);
});

test('two people editing DIFFERENT fields from the same copy both land', () => {
    const a = clone(base); a.properties[1] = { ...a.properties[1], name: 'Stage' };
    const b = clone(base); b.properties[2] = { ...b.properties[2], name: 'Gewonnen' };
    let server = applyDefinitionOps(base, diffDefinition(base, a)).next;
    server = applyDefinitionOps(server, diffDefinition(base, b)).next;
    assert.equal(server.properties[1].name, 'Stage');
    assert.equal(server.properties[2].name, 'Gewonnen');
});

test('a system database\'s canonical fields are never deleted or retyped (superadmin may); the title never', () => {
    const canonicalIds = new Set(['title', 'status']);
    const next = clone(base);
    next.properties = next.properties.filter(p => p.id !== 'status');
    next.properties[0] = { ...next.properties[0] };
    const r = applyDefinitionOps(base, diffDefinition(base, next), { canonicalIds });
    assert.deepEqual(r.refused.map(x => x.reason), ['canonical_field_delete']);
    assert.ok(r.next.properties.some(p => p.id === 'status'));

    const retype = clone(base); retype.properties[1] = { ...retype.properties[1], type: 'text' };
    assert.deepEqual(applyDefinitionOps(base, diffDefinition(base, retype), { canonicalIds }).refused.map(x => x.reason), ['canonical_field_retype']);
    assert.deepEqual(applyDefinitionOps(base, diffDefinition(base, retype), { canonicalIds, allowSystemEdit: true }).refused, []);

    const noTitle = clone(base); noTitle.properties = noTitle.properties.slice(1);
    assert.deepEqual(applyDefinitionOps(base, diffDefinition(base, noTitle), { allowSystemEdit: true }).refused.map(x => x.reason), ['title_field']);
});

test('the last view is never deleted; an order op keeps elements the sender did not know', () => {
    const one: Definition = { ...clone(base), views: [{ id: 'v1' }] };
    assert.deepEqual(applyDefinitionOps(one, [{ op: 'view.delete', id: 'v1' }]).refused.map(x => x.reason), ['last_view']);
    const server = clone(base); server.properties.push({ id: 'p-new', name: 'New one', type: 'text' });
    const r = applyDefinitionOps(server, [{ op: 'property.order', ids: ['won', 'title', 'status'] }]);
    assert.deepEqual(r.next.properties.map(p => p.id), ['won', 'title', 'status', 'p-new']);
});
