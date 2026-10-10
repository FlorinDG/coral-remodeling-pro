/**
 * IMPERSONATE-1 (Florin 2026-10-10): "Impersonation must not be able to cross tenant, even superadmin — if in an
 * impersonation session, guard to the current tenant." The session IS the impersonated tenant (scoped doors); every
 * cross-tenant platform power is closed until the impersonation ends.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { platformAccessOf } from '../src/lib/roles.ts';

describe('IMPERSONATE-1 · the rule', () => {
    test('a platform admin outside an impersonation has platform access', () => {
        assert.equal(platformAccessOf('SUPERADMIN', false), 'platform');
        assert.equal(platformAccessOf('TENANT_MANAGER', undefined), 'platform');
    });
    test('the same admin while impersonating is confined', () => {
        assert.equal(platformAccessOf('SUPERADMIN', true), 'impersonating');
        assert.equal(platformAccessOf('TENANT_MANAGER', true), 'impersonating');
    });
    test('a tenant role never has platform access, impersonation flag or not', () => {
        for (const r of ['TENANT_PRO_OWNER', 'TENANT_ENTERPRISE_OWNER', 'ACCOUNTANT', null, undefined, '']) {
            assert.equal(platformAccessOf(r, false), 'none');
            assert.equal(platformAccessOf(r, true), 'none');
        }
    });
});

describe('IMPERSONATE-1 · every platform door asks the gate', () => {
    test('platform actions: every one except the exit goes through requirePlatformAdmin', () => {
        const s = readFileSync('src/app/actions/superadmin.ts', 'utf8');
        assert.match(s, /async function verifySuperadmin\(\) \{\s*await requirePlatformAdmin\(\);\s*\}/);
        const fns = [...s.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
        assert.ok(fns.length >= 10);
        for (const [, name, body] of fns) {
            if (name === 'stopImpersonation') { assert.doesNotMatch(body, /verifySuperadmin\(\)/); continue; }
            assert.match(body, /await verifySuperadmin\(\)/, `${name} must ask the gate`);
        }
        assert.doesNotMatch(s, /PLATFORM_ADMIN_ROLES/);
    });
    test('the platform pages, the schema cleanup and the cross-tenant password reset use the impersonation-aware rule', () => {
        for (const p of ['src/app/[locale]/superadmin/page.tsx', 'src/app/[locale]/superadmin/tenants/page.tsx', 'src/app/[locale]/superadmin/billing/page.tsx', 'src/app/api/admin/schema-cleanup/route.ts']) {
            const s = readFileSync(p, 'utf8');
            assert.match(s, /\(await platformAccess\(\)\) !== 'platform'/, p);
            assert.doesNotMatch(s, /PLATFORM_ADMIN_ROLES\.includes/, p);
        }
        const reset = readFileSync('src/app/api/auth/admin-reset-password/route.ts', 'utf8');
        assert.match(reset, /const isPlatformAdmin = access === 'platform';/);
        assert.match(reset, /const isWorkspaceOwner = access === 'impersonating' \|\|/);
    });
});
