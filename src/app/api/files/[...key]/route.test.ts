import test from 'node:test';
import assert from 'node:assert';

// We isolate the logic to test it without Next.js dependencies
function checkIsolation(sessionTenantId: string | undefined, requestedKeySegments: string[]): { allowed: boolean, error?: string, status?: number } {
    if (!sessionTenantId) {
        return { allowed: false, error: 'Unauthorized', status: 401 };
    }

    if (!requestedKeySegments || requestedKeySegments.length === 0) {
        return { allowed: false, error: 'Key is required', status: 400 };
    }

    const key = requestedKeySegments.map(segment => decodeURIComponent(segment)).join('/');
    const requiredPrefix = `t_${sessionTenantId}/`;
    
    if (!key.startsWith(requiredPrefix)) {
        return { allowed: false, error: 'Forbidden: You do not have access to this file', status: 403 };
    }

    return { allowed: true };
}

test('Tenant Isolation - Rejects access to other tenant files', () => {
    const sessionTenantId = 'tenantA';
    const requestedKey = ['t_tenantB', 'project', '123', 'file.pdf'];

    const result = checkIsolation(sessionTenantId, requestedKey);
    
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.error, 'Forbidden: You do not have access to this file');
});

test('Tenant Isolation - Allows access to own files', () => {
    const sessionTenantId = 'tenantA';
    const requestedKey = ['t_tenantA', 'project', '123', 'file.pdf'];

    const result = checkIsolation(sessionTenantId, requestedKey);
    
    assert.strictEqual(result.allowed, true);
});

test('Tenant Isolation - Rejects access if no session', () => {
    const sessionTenantId = undefined;
    const requestedKey = ['t_tenantA', 'project', '123', 'file.pdf'];

    const result = checkIsolation(sessionTenantId, requestedKey);
    
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.status, 401);
});

test('Tenant Isolation - Rejects empty key', () => {
    const sessionTenantId = 'tenantA';
    const requestedKey: string[] = [];

    const result = checkIsolation(sessionTenantId, requestedKey);
    
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.status, 400);
});

test('Tenant Isolation - Handles URL decoded characters properly', () => {
    const sessionTenantId = 'tenantA';
    // If the browser encodes a space as %20
    const requestedKey = ['t_tenantA', 'project', 'my%20folder', 'file.pdf'];

    const result = checkIsolation(sessionTenantId, requestedKey);
    
    assert.strictEqual(result.allowed, true);
});
