import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteScanProperties, QUOTE_RECEIVED } from '../src/lib/records/quote-scan.ts';

const read = { supplierName: 'Desco', invoiceNumber: 'OFF-2026-118', issueDate: '2026-10-01', dueDate: '2026-10-31', totalExVat: 1200, totalVat: 252, totalIncVat: 1452, lines: [{ description: 'Tegels 60x60' }] };

test('a read quote lands on the quote\'s own fields — its validity in validUntil, never a payment due date', () => {
    const p = quoteScanProperties(read, { fileName: 'scan.pdf', isNew: true });
    assert.equal(p.title, 'OFF-2026-118');
    assert.equal(p.validUntil, '2026-10-31');
    assert.equal('dueDate' in p, false);
    assert.equal(p.invoiceDate, '2026-10-01');
    assert.equal(p.quoteStatus, QUOTE_RECEIVED);
    assert.equal(p.betreft, 'Tegels 60x60');
    assert.equal(p.reviewStatus, 'Klaar');
    for (const k of ['status', 'paidDate', 'structuredCommunication', 'peppolDocId']) assert.equal(k in p, false, k);
});

test('a re-scan never resets the status a person set, nor invents a title', () => {
    const p = quoteScanProperties({ ...read, invoiceNumber: null }, { isNew: false });
    assert.equal('quoteStatus' in p, false);
    assert.equal('title' in p, false);
});

test('what was not read is not written, and the record waits for a person with the reason', () => {
    const p = quoteScanProperties({ supplierName: 'Desco' }, { fileName: 'x.jpg', isNew: true });
    assert.equal(p.title, 'x.jpg');
    assert.equal('totalExVat' in p, false);
    assert.equal(p.reviewStatus, 'Na te kijken');
    assert.match(String(p.reviewReason), /datum, totaal/);
});
