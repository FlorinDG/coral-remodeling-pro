import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridAccess } from '../src/lib/records/grid-access.ts';

test('the accountant reads; the bestek is read-only below ENTERPRISE; everyone else edits (throw proof: accountant edit)', () => {
    assert.deepEqual(gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'invoices', isEnterprise: true }), { edit: false, create: false, delete: false });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'bestek', isEnterprise: false }), { edit: false, create: false, delete: false });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'bestek', isEnterprise: true }), { edit: true, create: true, delete: true });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'clients', isEnterprise: false }), { edit: true, create: true, delete: true });
});
