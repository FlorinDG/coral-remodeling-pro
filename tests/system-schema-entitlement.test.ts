import { test } from 'node:test';
import assert from 'node:assert/strict';
import { systemDatabaseEntitled } from '../src/lib/kernel/system-schema-entitlement.ts';
import { SYSTEM_DATABASES, SYSTEM_DATABASE_ROLES } from '../src/lib/kernel/system-databases.ts';
import { PLAN_MODULES } from '../src/lib/plan-modules.ts';

// One rule for columns (KERN-SCHEMA-1) and rows (createPageServerFirst, ENT-6).

test('FREE: invoicing only — no library, projects, tasks, CRM, bobex or HR (ENT-6: none of these may be created)', () => {
    const m = PLAN_MODULES.FREE;
    for (const role of ['articles', 'bestek', 'projects', 'tasks', 'crm', 'bobex', 'clients', 'quotations', 'hr'] as const) {
        assert.equal(systemDatabaseEntitled(role, 'FREE', m), false, role);
    }
    for (const role of ['invoices', 'suppliers', 'expenses', 'tickets', 'payments-in', 'payments-out'] as const) {
        assert.equal(systemDatabaseEntitled(role, 'FREE', m), true, role);
    }
});

test('PRO and up: the (empty) library, projects, tasks, CRM', () => {
    for (const plan of ['PRO', 'ENTERPRISE', 'FOUNDER']) {
        for (const role of ['articles', 'bestek', 'projects', 'tasks', 'crm', 'bobex'] as const) {
            assert.equal(systemDatabaseEntitled(role, plan, PLAN_MODULES[plan]), true, `${plan} ${role}`);
        }
    }
});

test('HR only where the HR module is granted (ENTERPRISE by default, not PRO)', () => {
    assert.equal(systemDatabaseEntitled('hr', 'PRO', PLAN_MODULES.PRO), false);
    assert.equal(systemDatabaseEntitled('hr', 'ENTERPRISE', PLAN_MODULES.ENTERPRISE), true);
});

test('a module switched off on a paying plan → that database is closed', () => {
    assert.equal(systemDatabaseEntitled('projects', 'PRO', ['INVOICING', 'CRM']), false);
    assert.equal(systemDatabaseEntitled('tasks', 'ENTERPRISE', ['INVOICING']), false);
});

test('the library follows the PLAN, not a module toggle — a FREE tenant with every module still has none', () => {
    assert.equal(systemDatabaseEntitled('articles', 'FREE', PLAN_MODULES.ENTERPRISE), false);
    assert.equal(systemDatabaseEntitled('articles', null, PLAN_MODULES.ENTERPRISE), false);
});

test('journal-general is explicitly ungated (until the Journal decision)', () => {
    assert.equal(systemDatabaseEntitled('journal-general', 'FREE', PLAN_MODULES.FREE), true);
});

test('every role is gated or EXPLICITLY ungated — only journal-general is open', () => {
    const open = SYSTEM_DATABASE_ROLES.filter(r => SYSTEM_DATABASES[r].module === null);
    assert.deepEqual(open, ['journal-general']);
});
