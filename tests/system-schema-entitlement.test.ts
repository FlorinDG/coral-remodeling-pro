import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaEntitled } from '../src/lib/kernel/system-schema-entitlement.ts';
import { PLAN_MODULES } from '../src/lib/plan-modules.ts';

test('FREE: no library (articles, bestek), no projects / tasks / CRM — invoicing only', () => {
    const m = PLAN_MODULES.FREE;
    assert.equal(schemaEntitled('articles', 'FREE', m), false);
    assert.equal(schemaEntitled('bestek', 'FREE', m), false);
    assert.equal(schemaEntitled('projects', 'FREE', m), false);
    assert.equal(schemaEntitled('tasks', 'FREE', m), false);
    assert.equal(schemaEntitled('crm', 'FREE', m), false);
    assert.equal(schemaEntitled('invoices', 'FREE', m), true);
});

test('PRO and up: the (empty) library gets its columns', () => {
    for (const plan of ['PRO', 'ENTERPRISE', 'FOUNDER']) {
        assert.equal(schemaEntitled('articles', plan, PLAN_MODULES[plan]), true, plan);
        assert.equal(schemaEntitled('bestek', plan, PLAN_MODULES[plan]), true, plan);
        assert.equal(schemaEntitled('projects', plan, PLAN_MODULES[plan]), true, plan);
    }
});

test('a module switched off on a paying plan → that database is not structured', () => {
    assert.equal(schemaEntitled('projects', 'PRO', ['INVOICING', 'CRM']), false);
});

test('no canonical schema (journal, hr) → never', () => {
    assert.equal(schemaEntitled('journal-general', 'ENTERPRISE', PLAN_MODULES.ENTERPRISE), false);
    assert.equal(schemaEntitled('hr', 'ENTERPRISE', PLAN_MODULES.ENTERPRISE), false);
});
