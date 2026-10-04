import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripeTenantPaymentRefusal, stripeAmountEuro } from '../src/lib/records/stripe-tenant-payment.ts';

const ok = { id: 'cs_1', payment_status: 'paid', mode: 'payment', currency: 'eur', amount_total: 121000, metadata: { tenantId: 'tA', invoiceId: 'inv-1' } };

test('a paid EUR payment session of THIS tenant, naming an invoice, is accepted', () => {
    assert.equal(stripeTenantPaymentRefusal(ok, 'tA'), null);
    assert.equal(stripeAmountEuro(121000), 1210);
});

test('a session whose metadata names ANOTHER tenant than the key owner is refused', () => {
    assert.equal(stripeTenantPaymentRefusal({ ...ok, metadata: { tenantId: 'tB', invoiceId: 'inv-1' } }, 'tA'), 'tenant_mismatch');
    assert.equal(stripeTenantPaymentRefusal({ ...ok, metadata: null }, 'tA'), 'tenant_mismatch');
});

test('no invoice id → refused: a tenant-confirmed session NEVER provisions a plan', () => {
    assert.equal(stripeTenantPaymentRefusal({ ...ok, metadata: { tenantId: 'tA', planType: 'ENTERPRISE' } }, 'tA'), 'no_invoice');
    assert.equal(stripeTenantPaymentRefusal({ ...ok, mode: 'subscription' }, 'tA'), 'not_a_payment');
});

test('unpaid, wrong currency or no amount → refused', () => {
    assert.equal(stripeTenantPaymentRefusal({ ...ok, payment_status: 'unpaid' }, 'tA'), 'not_paid');
    assert.equal(stripeTenantPaymentRefusal({ ...ok, currency: 'usd' }, 'tA'), 'currency');
    assert.equal(stripeTenantPaymentRefusal({ ...ok, amount_total: 0 }, 'tA'), 'amount');
    assert.equal(stripeTenantPaymentRefusal({ ...ok, amount_total: null }, 'tA'), 'amount');
});
