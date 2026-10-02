import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSchemaReconcile } from '../src/lib/kernel/system-schema-plan.ts';
import { canonicalSchemas } from '../src/lib/kernel/system-schemas.ts';

const canon = [
    { id: 'title', name: 'Naam', type: 'text' },
    { id: 'prop-a', name: 'A', type: 'number' },
    { id: 'prop-b', name: 'B', type: 'text' },
] as any[];

test('an empty database (Murgu: 0 fields) gets every canonical field, in canonical order', () => {
    const plan = planSchemaReconcile([], canon);
    assert.deepEqual(plan.added, ['title', 'prop-a', 'prop-b']);
    assert.deepEqual(plan.next!.map(p => p.id), ['title', 'prop-a', 'prop-b']);
});

test('only MISSING fields are added — an existing field is never changed, a custom one is kept', () => {
    const current = [
        { id: 'title', name: 'Mijn naam', type: 'text' },                 // renamed by the tenant
        { id: 'prop-a', name: 'A', type: 'formula', config: { formulaExpression: 'x' } }, // customised
        { id: 'custom', name: 'Eigen veld', type: 'text' },
    ] as any[];
    const plan = planSchemaReconcile(current, canon);
    assert.deepEqual(plan.added, ['prop-b']);
    assert.deepEqual(plan.next!.slice(0, 3), current);                    // untouched, same order
});

test('complete database → no write', () => {
    assert.equal(planSchemaReconcile(canon, canon).next, null);
});

test('versioned upgrade: accountantExportedAt becomes a checkbox (and nothing else changes)', () => {
    const plan = planSchemaReconcile([...canon, { id: 'accountantExportedAt', name: 'X', type: 'date' }] as any[], canon);
    assert.deepEqual(plan.upgraded, ['accountantExportedAt']);
    assert.equal(plan.next!.find(p => p.id === 'accountantExportedAt')!.type, 'checkbox');
});

test('kernel schemas: relations point at the TENANT\'s database ids; articles carry the real-discount formula; bestek exists', () => {
    const s = canonicalSchemas(base => `tenant-${base}`);
    const supplier = s['db-articles'].find(p => p.id === 'prop-art-supplier')!;
    assert.equal((supplier.config as any).relationDatabaseId, 'tenant-db-suppliers');
    const netto = s['db-articles'].find(p => p.id === 'prop-art-netto')!;
    assert.equal((netto.config as any).formulaExpression, 'round(if(empty(Discount), BruttoKost, BruttoKost * (1 - Discount / 100)), 2)');
    assert.equal((s['db-bestek'].find(p => p.id === 'prop-bst-articles')!.config as any).relationDatabaseId, 'tenant-db-articles');
});
