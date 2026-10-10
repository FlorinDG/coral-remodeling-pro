import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorLabel, editorShows, isPurchaseDocumentRole, needsValidation, purchaseView, purchaseWrite, readingSummary } from '../src/lib/records/purchase-document.ts';

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


test('a ticket shows only ticket fields — never the invoice fields (throw proof: OGM / IBAN / due date on a receipt)', () => {
    for (const f of ['supplierName', 'invoiceDate', 'totalIncVat', 'category', 'paymentMethod', 'notes', 'project']) assert.equal(editorShows('tickets', f), true, f);
    for (const f of ['supplierVat', 'ogm', 'supplierIban', 'dueDate', 'costType', 'ledgerAccount', 'vatRegime', 'paidDate', 'lines', 'totalVat', 'peppol']) assert.equal(editorShows('tickets', f), false, f);
    assert.equal(editorShows('expenses', 'ogm'), true);
    assert.equal(editorLabel('tickets', 'supplierName', 'Leverancier'), 'Admin.purchaseDocument.merchant');
    assert.equal(editorLabel('expenses', 'supplierName', 'Leverancier'), 'Leverancier');
});


test('what a reading found, in one Belgian line (throw proof: the import only said "Klaar")', () => {
    assert.equal(readingSummary('tickets', { title: 'Brico', date: '2026-10-02', amount: 12.5 }), 'Brico · 02/10/2026 · € 12,50');
    assert.equal(readingSummary('expenses', { supplierName: 'Aveve', invoiceDate: '2026-09-30', totalIncVat: 1210 }), 'Aveve · 30/09/2026 · € 1.210,00');
    assert.equal(readingSummary('tickets', { title: 'scan.jpg' }), 'scan.jpg');   // nothing else read
});

// QUOTE-IN-1 · a supplier quote in the same editor

test('QUOTE-IN-1: a quote opens in the purchase editor, but is never validated (it is not a cost)', () => {
    assert.equal(isPurchaseDocumentRole('purchase-quotes'), true);
    assert.equal(needsValidation('purchase-quotes'), false);
    assert.equal(needsValidation('expenses'), true);
    assert.equal(needsValidation('tickets'), true);
});

test('QUOTE-IN-1: the editor\'s "due date" is the quote\'s validity — read and written as validUntil', () => {
    assert.equal(purchaseView('purchase-quotes', { validUntil: '2026-11-30' }).dueDate, '2026-11-30');
    assert.deepEqual(purchaseWrite('purchase-quotes', 'dueDate', '2026-12-01'), { key: 'validUntil', value: '2026-12-01' });
    assert.equal(editorLabel('purchase-quotes', 'dueDate', 'Vervaldatum'), 'Admin.purchaseDocument.validUntil');
    assert.equal(editorLabel('purchase-quotes', 'invoiceDate', 'Factuurdatum'), 'Admin.purchaseDocument.quoteDate');
});

test('QUOTE-IN-1: no payment, accounting or Peppol fields on a quote — and they are never written', () => {
    for (const f of ['status', 'costType', 'ledgerAccount', 'vatRegime', 'paidDate', 'structuredCommunication', 'supplierIban', 'accounting']) {
        assert.equal(editorShows('purchase-quotes', f), false, f);
    }
    assert.equal(purchaseWrite('purchase-quotes', 'paidDate', '2026-10-01'), null);
    assert.equal(purchaseWrite('purchase-quotes', 'status', 'opt-paid'), null);
    for (const f of ['quoteStatus', 'lines', 'project', 'totalExVat']) assert.equal(editorShows('purchase-quotes', f), true, f);
});

test('QUOTE-IN-1: the quote status never shows on an invoice or a ticket', () => {
    assert.equal(editorShows('expenses', 'quoteStatus'), false);
    assert.equal(editorShows('tickets', 'quoteStatus'), false);
});
