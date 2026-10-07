import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseView, purchaseWrite } from '../src/lib/records/purchase-document.ts';

test('a ticket in the editor: its merchant / date / amount shown as supplier / date / total', () => {
    const v = purchaseView('tickets', { title: 'Brico', date: '2026-10-02', amount: 12.5, category: 'cat-tools' });
    assert.equal(v.supplierName, 'Brico');
    assert.equal(v.invoiceDate, '2026-10-02');
    assert.equal(v.totalIncVat, 12.5);
    assert.equal(v.title, 'Brico');
    assert.equal(v.category, 'cat-tools');
    const inv = { title: 'F-1', invoiceDate: '2026-10-01' };
    assert.equal(purchaseView('expenses', inv), inv);
});

test('an edit lands in the ticket\'s OWN field; invoice-only fields are never written to a ticket (throw proof: the date written to invoiceDate)', () => {
    assert.deepEqual(purchaseWrite('tickets', 'invoiceDate', '2026-10-03'), { key: 'date', value: '2026-10-03' });
    assert.deepEqual(purchaseWrite('tickets', 'totalIncVat', 20), { key: 'amount', value: 20 });
    assert.deepEqual(purchaseWrite('tickets', 'supplierName', 'Aveve'), { key: 'title', value: 'Aveve' });
    assert.deepEqual(purchaseWrite('tickets', 'category', 'cat-fuel'), { key: 'category', value: 'cat-fuel' });
    for (const k of ['dueDate', 'supplierIban', 'ogm', 'status', 'totalVat', 'totalExVat', 'title']) assert.equal(purchaseWrite('tickets', k, 'x'), null, k);
    assert.deepEqual(purchaseWrite('expenses', 'dueDate', '2026-11-01'), { key: 'dueDate', value: '2026-11-01' });
});

import { editorShows, editorLabel } from '../src/lib/records/purchase-document.ts';

test('a ticket shows only ticket fields — never the invoice fields (throw proof: OGM / IBAN / due date on a receipt)', () => {
    for (const f of ['supplierName', 'invoiceDate', 'totalIncVat', 'category', 'paymentMethod', 'notes', 'project']) assert.equal(editorShows('tickets', f), true, f);
    for (const f of ['supplierVat', 'ogm', 'supplierIban', 'dueDate', 'costType', 'ledgerAccount', 'vatRegime', 'paidDate', 'lines', 'totalVat', 'peppol']) assert.equal(editorShows('tickets', f), false, f);
    assert.equal(editorShows('expenses', 'ogm'), true);
    assert.equal(editorLabel('tickets', 'supplierName', 'Leverancier'), 'Handelaar');
    assert.equal(editorLabel('expenses', 'supplierName', 'Leverancier'), 'Leverancier');
});
