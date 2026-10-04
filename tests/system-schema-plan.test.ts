import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSchemaReconcile } from '../src/lib/kernel/system-schema-plan.ts';
import { canonicalSchemas } from '../src/lib/kernel/system-schemas.ts';
import { SCHEMA_UPGRADES, upgradesFor, type SchemaUpgrade } from '../src/lib/kernel/system-schema-upgrades.ts';

const canon = [
    { id: 'title', name: 'Naam', type: 'text' },
    { id: 'prop-a', name: 'A', type: 'number' },
    { id: 'prop-b', name: 'B', type: 'text' },
] as any[];

test('an empty database (Murgu: 0 fields) gets every canonical field, in canonical order', () => {
    const plan = planSchemaReconcile([], canon, []);
    assert.deepEqual(plan.added, ['title', 'prop-a', 'prop-b']);
    assert.deepEqual(plan.next!.map(p => p.id), ['title', 'prop-a', 'prop-b']);
});

test('only MISSING fields are added — an existing field is never changed, a custom one is kept', () => {
    const current = [
        { id: 'title', name: 'Mijn naam', type: 'text' },                 // renamed by the tenant
        { id: 'prop-a', name: 'A', type: 'formula', config: { formulaExpression: 'x' } }, // customised
        { id: 'custom', name: 'Eigen veld', type: 'text' },
    ] as any[];
    const plan = planSchemaReconcile(current, canon, SCHEMA_UPGRADES);
    assert.deepEqual(plan.added, ['prop-b']);
    assert.deepEqual(plan.next!.slice(0, 3), current);                    // untouched, same order
});

test('complete database → no write', () => {
    assert.equal(planSchemaReconcile(canon, canon, SCHEMA_UPGRADES).next, null);
});

test('upgrade U1: accountantExportedAt becomes a checkbox (and nothing else changes)', () => {
    const plan = planSchemaReconcile([...canon, { id: 'accountantExportedAt', name: 'X', type: 'date' }] as any[], canon, upgradesFor('db-expenses'));
    assert.deepEqual(plan.upgraded, ['U1-accountant-export-checkbox']);
    assert.deepEqual(plan.added, []);
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

// ── the numbered upgrade list ────────────────────────────────────────────────────────────────

test('every registered step: its guard matches the old shape, and no longer matches once applied', () => {
    for (const step of SCHEMA_UPGRADES) {
        assert.equal(step.before.id, step.propertyId, `${step.id}: 'before' is the wrong field`);
        assert.equal(step.appliesTo(step.before), true, `${step.id}: guard does not match its own old shape`);
        assert.equal(step.appliesTo(step.apply(step.before)), false, `${step.id}: applies again after running`);
    }
});

test('steps are numbered U1, U2, … in list order, ids unique', () => {
    SCHEMA_UPGRADES.forEach((step, i) => assert.match(step.id, new RegExp(`^U${i + 1}-`), `step ${i}: ${step.id}`));
    assert.equal(new Set(SCHEMA_UPGRADES.map(s => s.id)).size, SCHEMA_UPGRADES.length);
});

test('a fresh tenant needs no step: the canonical field never matches a guard', () => {
    const schemas = canonicalSchemas(base => base);
    for (const [base, fields] of Object.entries(schemas)) {
        for (const step of upgradesFor(base)) {
            const field = fields.find(p => p.id === step.propertyId);
            if (field) assert.equal(step.appliesTo(field), false, `${step.id} would rewrite the canonical ${base}.${field.id}`);
        }
    }
});

const oldFormula = 'round2(x * 35)';
const step = (id: string, from: string, to: string): SchemaUpgrade => ({
    id, bases: ['db-bestek'], propertyId: 'prop-total',
    appliesTo: p => (p.config as any)?.formulaExpression === from,
    apply: p => ({ ...p, config: { ...p.config, formulaExpression: to } }),
    before: { id: 'prop-total', name: 'Total', type: 'formula', config: { formulaExpression: from } },
});

test('a field the tenant changed themselves is left alone', () => {
    const own = [{ id: 'prop-total', name: 'Total', type: 'formula', config: { formulaExpression: 'my own' } }] as any[];
    const plan = planSchemaReconcile(own, own, [step('U1-x', oldFormula, 'new')]);
    assert.equal(plan.next, null);
});

test('steps run in order in one pass: U1 then U2 build on each other', () => {
    const current = [{ id: 'prop-total', name: 'Total', type: 'formula', config: { formulaExpression: oldFormula } }] as any[];
    const plan = planSchemaReconcile(current, current, [step('U1-a', oldFormula, 'mid'), step('U2-b', 'mid', 'final')]);
    assert.deepEqual(plan.upgraded, ['U1-a', 'U2-b']);
    assert.equal((plan.next![0].config as any).formulaExpression, 'final');
    assert.equal(planSchemaReconcile(plan.next!, plan.next!, [step('U1-a', oldFormula, 'mid'), step('U2-b', 'mid', 'final')]).next, null);
});

test('a step that would apply again is refused, not looped', () => {
    const bad: SchemaUpgrade = { ...step('U1-bad', oldFormula, oldFormula) };
    const current = [{ id: 'prop-total', name: 'Total', type: 'formula', config: { formulaExpression: oldFormula } }] as any[];
    assert.throws(() => planSchemaReconcile(current, current, [bad]), /not idempotent/);
});

test('upgradesFor: a step for the bestek is not offered to the articles', () => {
    const list = [step('U1-x', 'a', 'b')];
    assert.equal(upgradesFor('db-bestek', list).length, 1);
    assert.equal(upgradesFor('db-articles', list).length, 0);
});
