import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseVat, parseCompanyLookup, vatLookupPatch } from '../src/lib/records/vat-lookup.ts';

test('typed VAT → the number to look up; a bare 9/10-digit number is Belgian; incomplete → null', () => {
    assert.equal(normaliseVat('be 0123.456.789'), 'BE0123456789');
    assert.equal(normaliseVat('123456789'), 'BE0123456789');
    assert.equal(normaliseVat('NL123456789B01'), null);
    assert.equal(normaliseVat('BE01'), null);
});

test('the lookup answer → company, street, postcode, city; the patch fills only fields the database has', () => {
    const found = parseCompanyLookup({ isValid: true, name: 'Coral BV', address: 'Kerkstraat 1\n9000 Gent', peppolActive: true })!;
    assert.deepEqual(found, { name: 'Coral BV', street: 'Kerkstraat 1', postalCode: '9000', city: 'Gent', peppolActive: true });
    assert.equal(parseCompanyLookup({ isValid: false }), null);
    assert.deepEqual(vatLookupPatch(found, ['title', 'vat', 'company', 'city']), { company: 'Coral BV', city: 'Gent', peppol_active: true });
    assert.deepEqual(vatLookupPatch({ ...found, name: null }, ['company']), { peppol_active: true });
});
