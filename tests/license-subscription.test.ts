import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basePlanOf, licenseStatusOf, licenseEventRefusal, planChanged } from '../src/lib/records/license-subscription.ts';

const table = {
    PRO_MONTHLY: { test: 'p_pro', prod: 'P_PRO' },
    ENT_MONTHLY: { test: 'p_ent', prod: 'P_ENT' },
    EXTRA_USER_PRO: { test: 'p_xu_pro', prod: 'P_XU_PRO' },
    EXTRA_USER_ENT: { test: 'p_xu_ent', prod: 'P_XU_ENT' },
    WORKFORCE_PRO: { test: 'p_wf_pro', prod: 'P_WF_PRO' },
};

test('the plan comes from the BASE plan price, wherever it sits among the items', () => {
    assert.equal(basePlanOf(['P_XU_ENT', 'P_ENT'], table, 'prod'), 'ENTERPRISE');
    assert.equal(basePlanOf(['P_WF_PRO', 'P_PRO'], table, 'prod'), 'PRO');
    assert.equal(basePlanOf(['p_pro'], table, 'test'), 'PRO');
});

test('an unknown price or only add-ons → null (no plan change), never a default PRO', () => {
    assert.equal(basePlanOf(['price_custom_founder'], table, 'prod'), null);
    assert.equal(basePlanOf(['P_XU_PRO', 'P_WF_PRO'], table, 'prod'), null);
    assert.equal(basePlanOf([], table, 'prod'), null);
    assert.equal(basePlanOf(['p_pro'], table, 'prod'), null);   // a test price in prod is unknown
});

test('Stripe statuses map; unknown ones change nothing', () => {
    assert.equal(licenseStatusOf('active'), 'ACTIVE');
    assert.equal(licenseStatusOf('trialing'), 'TRIAL');
    assert.equal(licenseStatusOf('unpaid'), 'PAST_DUE');
    assert.equal(licenseStatusOf('incomplete_expired'), 'CANCELLED');
    assert.equal(licenseStatusOf('incomplete'), null);
    assert.equal(licenseStatusOf(undefined), null);
});

const tenant = { id: 't1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_new' };

test('an event of an OLD subscription does not touch the tenant (its delete no longer drops an active tenant to FREE)', () => {
    assert.equal(licenseEventRefusal(tenant, { customerId: 'cus_1', metadataTenantId: 't1', subscriptionId: 'sub_old', kind: 'subscription' }), 'other_subscription');
    assert.equal(licenseEventRefusal(tenant, { customerId: 'cus_1', metadataTenantId: 't1', subscriptionId: 'sub_new', kind: 'subscription' }), null);
});

test('the customer and the metadata must point at the same tenant', () => {
    assert.equal(licenseEventRefusal(tenant, { customerId: 'cus_2', metadataTenantId: 't1', subscriptionId: 'sub_new', kind: 'subscription' }), 'customer_mismatch');
    assert.equal(licenseEventRefusal(tenant, { customerId: 'cus_1', metadataTenantId: 't2', subscriptionId: 'sub_new', kind: 'checkout' }), 'tenant_mismatch');
    // first purchase: no customer / subscription on the tenant yet
    assert.equal(licenseEventRefusal({ id: 't1', stripeCustomerId: null, stripeSubscriptionId: null }, { customerId: 'cus_1', metadataTenantId: 't1', subscriptionId: 'sub_1', kind: 'checkout' }), null);
});

test('the plan template applies only when the plan CHANGES (a renewal keeps manual module grants)', () => {
    assert.equal(planChanged('ENTERPRISE', 'ENTERPRISE'), false);
    assert.equal(planChanged('enterprise', 'ENTERPRISE'), false);
    assert.equal(planChanged('PRO', 'ENTERPRISE'), true);
    assert.equal(planChanged(null, 'PRO'), true);
});
