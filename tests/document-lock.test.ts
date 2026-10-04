import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDocumentLock, isQuoteLocked } from '../src/lib/records/document-lock.ts';

const sent = { title: 'OFF-2026-042', status: 'opt-sent', betreft: 'Badkamer', totalExVat: 1000 };
const lines = [{ id: 'b1', type: 'line', content: 'Tegels', quantity: 10, unitPrice: 45 }];

test('sent, accepted and rejected quotes are locked; drafts are not', () => {
    assert.equal(isQuoteLocked({ status: 'opt-sent' }), true);
    assert.equal(isQuoteLocked({ status: 'opt-accepted' }), true);
    assert.equal(isQuoteLocked({ status: 'opt-rejected' }), true);
    assert.equal(isQuoteLocked({ status: 'opt-draft' }), false);
    assert.equal(isQuoteLocked({}), false);
});

test('a sent quote refuses changed lines and changed texts / prices', () => {
    assert.deepEqual(checkDocumentLock('quotations', sent, { ...sent, betreft: 'Keuken' })?.blockedFields, ['betreft']);
    assert.deepEqual(checkDocumentLock('quotations', sent, sent, lines, [{ ...lines[0], quantity: 12 }])?.blockedFields, ['blocks']);
});

test('a sent quote still accepts: the status move, the signature, the archive, the revision link', () => {
    assert.equal(checkDocumentLock('quotations', sent, { ...sent, status: 'opt-accepted', clientSignature: 'data:…', consentName: 'Jan', signedAt: 'x' }), null);
    assert.equal(checkDocumentLock('quotations', sent, { ...sent, receiptUrl: 't_x/documents/a.pdf', revisedTo: ['q2'] }), null);
    assert.equal(checkDocumentLock('quotations', sent, sent, lines, lines), null);          // unchanged lines pass
});

test('a sent quote cannot be put back to draft — that would unlock it', () => {
    assert.deepEqual(checkDocumentLock('quotations', sent, { ...sent, status: 'opt-draft' })?.blockedFields, ['status']);
    assert.equal(checkDocumentLock('quotations', sent, { ...sent, status: 'opt-rejected' }), null);
});

test('drafts and other databases are never document-locked', () => {
    assert.equal(checkDocumentLock('quotations', { ...sent, status: 'opt-draft' }, { betreft: 'Keuken' }), null);
    assert.equal(checkDocumentLock('invoices', sent, { ...sent, betreft: 'Keuken' }), null);
});
