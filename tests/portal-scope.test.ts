import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portalScope } from '../src/lib/data/scope.ts';

// PT-5: the portal scope opens ONLY on a verified portal access — never on a raw id.

test('portalScope refuses without a verified access', () => {
    assert.throws(() => portalScope(undefined as any), /no verified portal access/);
    assert.throws(() => portalScope({ success: false } as any), /no verified portal access/);
    assert.throws(() => portalScope({ success: true, portal: { id: 'p1' } } as any), /no verified portal access/);
    // a FAILED verification still carries the portal (PortalAuthResult) — it must not open the scope
    assert.throws(() => portalScope({ success: false, status: 401, error: 'x', portal: { id: 'p1', tenantId: 't1' } } as any), /no verified portal access/);
});

test('portalScope opens on a verified access (a scoped client comes back)', () => {
    const db = portalScope({ success: true, portal: { id: 'p1', tenantId: 't1' } });
    assert.equal(typeof (db as any).globalPage?.findMany, 'function');
});
