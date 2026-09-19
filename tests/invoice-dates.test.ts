import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDueDate, resolveInvoiceDatesOnSend } from '../src/lib/invoices/due-date.ts';

test('SP-2: calculateDueDate with pay-* method', () => {
    assert.equal(calculateDueDate('2026-09-01', 'pay-30'), '2026-10-01');
    assert.equal(calculateDueDate('2026-09-01', 'pay-14'), '2026-09-15');
    assert.equal(calculateDueDate('2026-09-01', 'pay-0'), '2026-09-01');
    assert.equal(calculateDueDate('2026-09-01', 'pay-60'), '2026-10-31');
    assert.equal(calculateDueDate('2026-09-01', 'pay-90'), '2026-11-30');
});

test('SP-2: calculateDueDate fallback without method', () => {
    assert.equal(calculateDueDate('2026-09-01', undefined, 30), '2026-10-01');
    assert.equal(calculateDueDate('2026-09-01', null, 15), '2026-09-16');
    assert.equal(calculateDueDate('', 'pay-30'), '');
});

test('SP-2: resolveInvoiceDatesOnSend stamps today when invoiceDate is missing', () => {
    const today = new Date().toISOString().split('T')[0];
    const props = { title: 'Factuur 2026-100', 'prop-payment-method': 'pay-14' };
    const res = resolveInvoiceDatesOnSend(props);

    assert.equal(res.updates.invoiceDate, today);
    assert.ok(res.updates.dueDate);
    assert.equal(res.invoiceDate, today);
    assert.equal(res.dueDate, res.updates.dueDate);
});

test('SP-2: resolveInvoiceDatesOnSend preserves existing user-chosen invoiceDate', () => {
    const props = {
        title: 'Factuur 2026-100',
        invoiceDate: '2026-08-15',
        'prop-payment-method': 'pay-30',
    };
    const res = resolveInvoiceDatesOnSend(props);

    assert.equal(res.updates.invoiceDate, undefined, 'Existing invoiceDate must not be in updates');
    assert.equal(res.invoiceDate, '2026-08-15');
    assert.equal(res.updates.dueDate, '2026-09-14');
});

test('SP-2: resolveInvoiceDatesOnSend preserves existing user-chosen dueDate', () => {
    const props = {
        title: 'Factuur 2026-100',
        invoiceDate: '2026-08-15',
        dueDate: '2026-09-30',
        'prop-payment-method': 'pay-14',
    };
    const res = resolveInvoiceDatesOnSend(props);

    assert.equal(res.updates.invoiceDate, undefined);
    assert.equal(res.updates.dueDate, undefined, 'Existing dueDate must not be in updates');
    assert.equal(res.invoiceDate, '2026-08-15');
    assert.equal(res.dueDate, '2026-09-30');
});
