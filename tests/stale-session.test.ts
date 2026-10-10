/**
 * STALE-SESSION-1 (Florin 2026-10-10): after the preview database was reset, the old session named a tenant the new
 * data lacked; the shell ran with no bindings ("unbound_system_database", an empty employee list). A session whose
 * tenant or user no longer exists now ends; an impersonation of a gone tenant ends just the impersonation.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { staleSessionReason, staleSessionUrl } from '../src/lib/session-guard.ts';

describe('STALE-SESSION-1 · the rule', () => {
    test('a missing tenant or user ends the session; an impersonated tenant that is gone ends the impersonation', () => {
        assert.equal(staleSessionReason({ tenantFound: false, userFound: true, impersonating: false }), 'tenant');
        assert.equal(staleSessionReason({ tenantFound: false, userFound: true, impersonating: true }), 'impersonation');
        assert.equal(staleSessionReason({ tenantFound: true, userFound: false, impersonating: false }), 'user');
        assert.equal(staleSessionReason({ tenantFound: true, userFound: true, impersonating: false }), null);
    });
    test('a FAILED read (database down) is not proof of absence — the session is kept', () => {
        assert.equal(staleSessionReason({ tenantFound: null, userFound: null, impersonating: false }), null);
        assert.equal(staleSessionReason({ tenantFound: null, userFound: true, impersonating: true }), null);
    });
    test('the exit', () => assert.equal(staleSessionUrl('tenant'), '/api/auth/stale-session?reason=tenant'));
});

describe('STALE-SESSION-1 · where it is applied', () => {
    test('the three shells end a stale session (admin: its own reads; mobile office and WorkHub: the door)', () => {
        const admin = readFileSync('src/app/[locale]/admin/layout.tsx', 'utf8');
        assert.match(admin, /const stale = staleSessionReason\(\{ tenantFound, userFound, impersonating: isImpersonating \}\);\s*if \(stale\) \{[\s\S]{0,120}redirect\(staleSessionUrl\(stale\)\);/);
        for (const p of ['src/app/[locale]/m/layout.tsx', 'src/app/[locale]/workhub/layout.tsx']) {
            assert.match(readFileSync(p, 'utf8'), /const stale = await staleSessionOf\([^\n]*\);\s*if \(stale\) redirect\(staleSessionUrl\(stale\)\);/, p);
        }
    });
    test('the exit clears the caller\'s cookies with Secure for __Secure- names (a plain delete is ignored by the browser)', () => {
        const r = readFileSync('src/app/api/auth/stale-session/route.ts', 'utf8');
        assert.match(r, /secure: name\.startsWith\('__Secure-'\)/);
        assert.match(r, /if \(reason === 'impersonation'\) \{\s*const res = NextResponse\.redirect\(new URL\('\/superadmin'/);
        assert.match(r, /new URL\('\/login\?session=stale'/);
    });
});
