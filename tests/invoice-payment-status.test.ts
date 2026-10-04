import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInvoiceStatus, nextExpenseStatus, paidTowards, linkedInvoiceId } from '../src/lib/records/invoice-payment-status.ts';

const today = '2026-10-04';
const base = { status: 'opt-sent', totalIncVat: 1000, paid: null as number | null, dueDate: '2026-10-30', today };

test('payments covering the total → paid; a partial payment changes nothing', () => {
    assert.equal(nextInvoiceStatus({ ...base, paid: 1000 }), 'opt-paid');
    assert.equal(nextInvoiceStatus({ ...base, paid: 999.996 }), 'opt-paid');     // rounding to the cent
    assert.equal(nextInvoiceStatus({ ...base, paid: 1 }), 'opt-sent');            // €1 never pays €1,000
    assert.equal(nextInvoiceStatus({ ...base, status: 'opt-overdue', paid: 1000 }), 'opt-paid');
});

test('a status a PERSON set is never undone — paid without payment rows stays paid; credited / uncollectible untouched', () => {
    assert.equal(nextInvoiceStatus({ ...base, status: 'opt-paid', paid: 0 }), 'opt-paid');
    assert.equal(nextInvoiceStatus({ ...base, status: 'opt-paid', paid: null, dueDate: '2026-01-01' }), 'opt-paid');
    for (const s of ['opt-credited', 'opt-partially-credited', 'opt-uncollectible']) {
        assert.equal(nextInvoiceStatus({ ...base, status: s, paid: 1000 }), s, s);
        assert.equal(nextInvoiceStatus({ ...base, status: s, dueDate: '2026-01-01' }), s, s);
    }
});

test('sent and past due (Brussels date) → overdue; due today or later → unchanged', () => {
    assert.equal(nextInvoiceStatus({ ...base, dueDate: '2026-10-03' }), 'opt-overdue');
    assert.equal(nextInvoiceStatus({ ...base, dueDate: '2026-10-04' }), 'opt-sent');
    assert.equal(nextInvoiceStatus({ ...base, dueDate: '' }), 'opt-sent');
    assert.equal(nextInvoiceStatus({ ...base, status: 'opt-draft', dueDate: '2026-01-01' }), 'opt-draft');   // never sent
});

test('a zero or missing total is never "paid" (credit notes, empty drafts)', () => {
    assert.equal(nextInvoiceStatus({ ...base, totalIncVat: 0, paid: 0 }), 'opt-sent');
    assert.equal(nextInvoiceStatus({ ...base, totalIncVat: -50, paid: 0 }), 'opt-sent');
    assert.equal(nextInvoiceStatus({ ...base, totalIncVat: undefined, paid: 10 }), 'opt-sent');
});

test('expenses: unpaid and past due → overdue, nothing else', () => {
    assert.equal(nextExpenseStatus('opt-unpaid', '2026-10-03', today), 'opt-overdue');
    assert.equal(nextExpenseStatus('opt-unpaid', '2026-10-04', today), 'opt-unpaid');
    assert.equal(nextExpenseStatus('opt-paid', '2026-01-01', today), 'opt-paid');
});

test('payments are summed per linked invoice only (array or bare id)', () => {
    const pays = [
        { invoice: ['inv-1'], amount: 400 },
        { invoice: 'inv-1', amount: 600.004 },
        { invoice: ['inv-2'], amount: 999 },
        { invoice: [], amount: 50 },
        { invoice: ['inv-1'], amount: 'x' },
    ];
    assert.equal(paidTowards('inv-1', pays), 1000);
    assert.equal(paidTowards('inv-3', pays), 0);
    assert.equal(linkedInvoiceId({ invoice: [] }), null);
});
