import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridAccess } from '../src/lib/records/grid-access.ts';

test('the accountant reads; the bestek is read-only below ENTERPRISE; everyone else edits (throw proof: accountant edit)', () => {
    assert.deepEqual(gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'invoices', isEnterprise: true }), { edit: false, create: false, delete: false });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'bestek', isEnterprise: false }), { edit: false, create: false, delete: false });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'bestek', isEnterprise: true }), { edit: true, create: true, delete: true });
    assert.deepEqual(gridAccess({ userRole: 'TENANT_ADMIN', logicalKey: 'clients', isEnterprise: false }), { edit: true, create: true, delete: true });
});

import { licensedColumns } from '../src/lib/records/grid-access.ts';

test('"Lead source" hidden on contacts without CRM only', () => {
    const props = [{ name: 'Naam' }, { name: 'Lead Source' }];
    assert.equal(licensedColumns(props, { logicalKey: 'clients', hasCRM: false }).length, 1);
    assert.equal(licensedColumns(props, { logicalKey: 'clients', hasCRM: true }).length, 2);
    assert.equal(licensedColumns(props, { logicalKey: 'suppliers', hasCRM: false }).length, 2);
});

import { duplicateProperties } from '../src/lib/records/grid-access.ts';

test('duplicate: never a document; never the stamps (throw proof: an invoice copy kept its OGM and "sent")', () => {
    assert.equal(duplicateProperties('invoices', { title: 'F-1', status: 'opt-sent', structuredComm: '+++1+++' }), null);
    assert.equal(duplicateProperties('quotations', { title: 'Q' }), null);
    assert.deepEqual(duplicateProperties('clients', { title: 'Acme', vat: 'BE1', accountantExportedAt: true, comments: 'x', receiptUrl: 't_x/a.pdf' }), { title: 'Acme (kopie)', vat: 'BE1' });
    assert.deepEqual(duplicateProperties(null, { title: '', a: 1 }), { title: '', a: 1 });
});
