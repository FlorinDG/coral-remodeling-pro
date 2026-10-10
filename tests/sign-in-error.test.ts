/**
 * SIGNIN-ERR-1 (Florin 2026-10-10): the preview said "Invalid credentials" while its database password had been
 * reset — every failure looked like a wrong password. A wrong password and a server failure are now told apart.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signInFailure } from '../src/lib/sign-in-error.ts';

test('CredentialsSignin is a wrong account/password; any other code is the server', () => {
    assert.deepEqual(signInFailure('CredentialsSignin'), { kind: 'credentials' });
    assert.deepEqual(signInFailure('Configuration'), { kind: 'server', code: 'Configuration' });
    assert.deepEqual(signInFailure('CallbackRouteError'), { kind: 'server', code: 'CallbackRouteError' });
    assert.equal(signInFailure(null), null);
});

test('both sign-in pages use it — a server failure is never shown as "Invalid credentials"', () => {
    for (const p of ['src/app/[locale]/login/page.tsx', 'src/app/[locale]/admin/login/page.tsx']) {
        const s = readFileSync(p, 'utf8');
        assert.match(s, /signInFailure\(result\.error\)/, p);
        assert.match(s, /f\?\.kind === 'server' \? tSystem\('signInServerError', \{ code: f\.code \}\) : 'Invalid credentials'/, p);
    }
});
