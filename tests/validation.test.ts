import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidated, approveRefusal } from '../src/lib/records/validation.ts';

test('what counts: approved, never-reviewed (manual / older), Peppol — not a scan waiting (throw proof: an unread scan exported)', () => {
    assert.equal(isValidated({ reviewStatus: 'Goedgekeurd' }), true);
    assert.equal(isValidated({ title: 'manual' }), true);
    assert.equal(isValidated({ source: 'src-peppol', reviewStatus: 'Na te kijken' }), true);   // validated at network level
    for (const s of ['In verwerking', 'Na te kijken', 'Klaar', 'Mislukt']) assert.equal(isValidated({ reviewStatus: s, source: 'src-scan' }), false, s);
});

test('approving needs the essentials (throw proof: "Expense", €0 approved)', () => {
    assert.deepEqual(approveRefusal('tickets', { title: 'Expense', amount: 0 }), ['title', 'date', 'amount']);
    assert.equal(approveRefusal('tickets', { title: 'Brico', date: '2026-10-02', amount: '12,50' }), null);
    assert.deepEqual(approveRefusal('expenses', { supplierName: 'X', invoiceDate: '2026-10-01', totalExVat: 100, totalVat: 21, totalIncVat: 131 }), ['totalVat']);
    assert.equal(approveRefusal('expenses', { supplier: ['s1'], invoiceDate: '2026-10-01', totalExVat: 100, totalVat: 21, totalIncVat: 121 }), null);
    assert.deepEqual(approveRefusal('expenses', {}), ['supplier', 'invoiceDate', 'totalIncVat']);
    assert.equal(approveRefusal('clients', {}), null);
});

import { approvalPlan } from '../src/lib/records/validation.ts';

test('bulk approve: the complete ones are approved, the others are named with what they lack', () => {
    const plan = approvalPlan('tickets', [
        { id: 'a', properties: { title: 'Brico', date: '2026-10-02', amount: 12, reviewStatus: 'Na te kijken', source: 'src-scan' } },
        { id: 'b', properties: { title: 'Expense', amount: 0, reviewStatus: 'Na te kijken', source: 'src-scan' } },
        { id: 'c', properties: { title: 'Done', reviewStatus: 'Goedgekeurd' } },
    ]);
    assert.deepEqual(plan, { approve: ['a'], refused: [{ id: 'b', missing: ['title', 'date', 'amount'] }] });
});
