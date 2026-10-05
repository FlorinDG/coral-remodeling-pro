import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridAccess } from '../src/lib/records/grid-access.ts';

test('the accountant reads; the bestek is read-only below ENTERPRISE; everyone else edits (throw proof: accountant edit)', () => {
    assert.deepEqual(gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'invoices', isEnterprise: true }), { edit: false, create: false, delete: false });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'bestek', isEnterprise: false }), { edit: false, create: false, delete: false });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'bestek', isEnterprise: true }), { edit: true, create: true, delete: true });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'clients', isEnterprise: false }), { edit: true, create: true, delete: true });
});

import { bulkApproveCheck, licensedColumns } from '../src/lib/records/grid-access.ts';

test('bulk approve only "Klaar" records; the rest are named (throw proof: a "Na te kijken" record approved)', () => {
    assert.deepEqual(bulkApproveCheck([{ id: 'a', properties: { reviewStatus: 'Klaar' } }]), { ok: true, ids: ['a'] });
    assert.deepEqual(bulkApproveCheck([{ id: 'a', properties: { reviewStatus: 'Klaar' } }, { id: 'b', properties: { reviewStatus: 'Na te kijken' } }]), { ok: false, notReady: ['b'] });
});

test('"Lead source" hidden on contacts without CRM only', () => {
    const props = [{ name: 'Naam' }, { name: 'Lead Source' }];
    assert.equal(licensedColumns(props, { logicalKey: 'clients', hasCRM: false }).length, 1);
    assert.equal(licensedColumns(props, { logicalKey: 'clients', hasCRM: true }).length, 2);
    assert.equal(licensedColumns(props, { logicalKey: 'suppliers', hasCRM: false }).length, 2);
});
