import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
    signPortalSessionToken,
    verifyPortalSessionToken,
    verifyPortalAccess,
    PORTAL_SESSION_COOKIE
} from '../src/lib/portal-auth.ts';
import { AuthNotConfiguredError } from '../src/lib/auth-secret.ts';

// AUTH-SECRET-1: the portal has no default secret — the tests set their own (read at call time).
const TEST_SECRET = 'test-portal-secret';
process.env.PORTAL_AUTH_SECRET = TEST_SECRET;

test('AUTH-SECRET-1 · portal: no PORTAL_AUTH_SECRET and no AUTH_SECRET → no token is signed', () => {
    const saved = { p: process.env.PORTAL_AUTH_SECRET, a: process.env.AUTH_SECRET };
    delete process.env.PORTAL_AUTH_SECRET; delete process.env.AUTH_SECRET;
    try { assert.throws(() => signPortalSessionToken('portal-x'), AuthNotConfiguredError); }
    finally { process.env.PORTAL_AUTH_SECRET = saved.p; if (saved.a !== undefined) process.env.AUTH_SECRET = saved.a; }
});

test('PORTAL-1 · session token: valid token round-trip verifies portalId', () => {
    const portalId = 'portal-alpha-123';
    const token = signPortalSessionToken(portalId);
    assert.ok(token.includes('.'), 'token has format payload.signature');

    const verified = verifyPortalSessionToken(token);
    assert.notEqual(verified, null);
    assert.equal(verified?.portalId, portalId);
});

test('PORTAL-1 · session token: tampered token is rejected', () => {
    const token = signPortalSessionToken('portal-alpha-123');
    const [payload, sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ portalId: 'portal-tampered', exp: Date.now() + 10000 })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${sig}`;

    assert.equal(verifyPortalSessionToken(tamperedToken), null);
});

test('PORTAL-1 · session token: expired token is rejected', () => {
    const expPast = Date.now() - 1000;
    const payloadStr = Buffer.from(JSON.stringify({ portalId: 'portal-expired', exp: expPast })).toString('base64url');
    const secret = TEST_SECRET;
    const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    const expiredToken = `${payloadStr}.${sig}`;

    assert.equal(verifyPortalSessionToken(expiredToken), null);
});

describe('PORTAL-1 · verifyPortalAccess', { todo: 'needs an integration harness' }, () => {
test('PORTAL-1 · verifyPortalAccess: unverified password-protected portal returns unverified: true, no leak', async () => {
    const hash = await bcrypt.hash('secret123', 8);
    const mockPortal = {
        id: 'portal-1',
        slug: 'slug-client-1',
        tenantId: 'tenant-1',
        clientName: 'Alice Smith',
        projectTitle: 'Kitchen Renovation',
        password: hash,
        quotes: [{ id: 'q1', total: 5000 }],
        invoices: [{ id: 'inv1', total: 3000 }],
        tasks: [{ id: 't1', title: 'Measure space' }],
    };

    const req = new Request('https://app.coral.test/api/portals/slug/slug-client-1');
    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortal });

    assert.equal(result.success, false);
    if (!result.success) {
        assert.equal(result.status, 401);
        assert.equal(result.unverified, true);
        assert.equal(result.portal.id, 'portal-1');
    }
});

test('PORTAL-1 · verifyPortalAccess: wrong password returns 401 Invalid password', async () => {
    const hash = await bcrypt.hash('secret123', 8);
    const mockPortal = {
        id: 'portal-1',
        slug: 'slug-client-1',
        tenantId: 'tenant-1',
        clientName: 'Alice Smith',
        password: hash,
    };

    const req = new Request('https://app.coral.test/api/portals/slug/slug-client-1');
    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortal, explicitPassword: 'wrong-password' });

    assert.equal(result.success, false);
    if (!result.success) {
        assert.equal(result.status, 401);
        assert.equal(result.error, 'Invalid password');
        assert.equal(result.unverified, undefined);
    }
});

test('PORTAL-1 · verifyPortalAccess: correct password returns success and sets tenantId from portal', async () => {
    const hash = await bcrypt.hash('secret123', 8);
    const mockPortal = {
        id: 'portal-1',
        slug: 'slug-client-1',
        tenantId: 'tenant-coral-real',
        clientName: 'Alice Smith',
        password: hash,
    };

    const req = new Request('https://app.coral.test/api/portals/slug/slug-client-1');
    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortal, explicitPassword: 'secret123' });

    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.tenantId, 'tenant-coral-real');
        assert.equal(result.portal.id, 'portal-1');
        assert.equal(result.newSession, true);
    }
});

test('PORTAL-1 · verifyPortalAccess: valid cookie allows access without resending password', async () => {
    const hash = await bcrypt.hash('secret123', 8);
    const mockPortal = {
        id: 'portal-1',
        slug: 'slug-client-1',
        tenantId: 'tenant-coral-real',
        clientName: 'Alice Smith',
        password: hash,
    };

    const token = signPortalSessionToken('portal-1');
    const req = new Request('https://app.coral.test/api/portals/slug/slug-client-1', {
        headers: {
            'cookie': `${PORTAL_SESSION_COOKIE}=${token}`
        }
    });

    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortal });
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.fromSession, true);
        assert.equal(result.tenantId, 'tenant-coral-real');
    }
});

test('PORTAL-1 · cookie scope: cookie for portal A is REJECTED when calling portal B', async () => {
    const hashB = await bcrypt.hash('passwordB', 8);
    const mockPortalB = {
        id: 'portal-B',
        slug: 'slug-b',
        tenantId: 'tenant-coral-real',
        clientName: 'Bob Client',
        password: hashB,
    };

    // Caller holds cookie issued for portal A
    const tokenForA = signPortalSessionToken('portal-A');
    const req = new Request('https://app.coral.test/api/portals/slug/slug-b', {
        headers: {
            'cookie': `${PORTAL_SESSION_COOKIE}=${tokenForA}`
        }
    });

    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortalB });
    // Must be rejected for portal B
    assert.equal(result.success, false);
    if (!result.success) {
        assert.equal(result.status, 401);
        assert.equal(result.unverified, true);
    }
});

test('PORTAL-1 · PORTAL-4: portal with password == null serves full payload without credentials', async () => {
    const mockPortalNoPassword = {
        id: 'portal-open',
        slug: 'slug-open',
        tenantId: 'tenant-coral-real',
        clientName: 'Open Client',
        password: null,
    };

    const req = new Request('https://app.coral.test/api/portals/slug/slug-open');
    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortalNoPassword });

    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.tenantId, 'tenant-coral-real');
        assert.equal(result.portal.id, 'portal-open');
    }
});

test('PORTAL-1 · write route: client with cookie can write without ERP session', async () => {
    const hash = await bcrypt.hash('pwd', 8);
    const mockPortal = {
        id: 'portal-write-1',
        slug: 'slug-write',
        tenantId: 'tenant-coral-real',
        clientName: 'Charlie',
        password: hash,
    };

    const token = signPortalSessionToken('portal-write-1');
    const req = new Request('https://app.coral.test/api/portals/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'cookie': `${PORTAL_SESSION_COOKIE}=${token}`
        },
        body: JSON.stringify({
            portalId: 'portal-write-1',
            content: 'Hello from client'
        })
    });

    const result = await verifyPortalAccess(req, { preloadedPortal: mockPortal });
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.tenantId, 'tenant-coral-real');
    }
});
});
