import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { authSecretOf, authSecret, AuthNotConfiguredError } from '../src/lib/auth-secret.ts';

// AUTH-SECRET-1 (Florin 2026-10-10): no AUTH_SECRET → nothing moves forward. Never a default secret.

test('AUTH-SECRET-1: a missing or blank secret is no secret', () => {
    for (const v of [undefined, null, '', '   ']) assert.equal(authSecretOf(v), null);
    assert.equal(authSecretOf('s3cr3t'), 's3cr3t');
});

test('AUTH-SECRET-1: authSecret() throws without one, never returns a default', () => {
    const before = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try { assert.throws(() => authSecret(), AuthNotConfiguredError); }
    finally { if (before !== undefined) process.env.AUTH_SECRET = before; }
});

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
}

test('AUTH-SECRET-1: no source file reads AUTH_SECRET with a fallback, and the emergency back door is gone', () => {
    // lib/encryption.ts (a dev default key, imported by nothing) was deleted on 2026-10-10.
    const offenders = sources('src').filter(f => /\bAUTH_SECRET\s*(\?\?|\|\|)|fallback-secret|coral-secret-12345|dev-secret-key/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(offenders, []);
    assert.equal(sources('src').some(f => f.includes('emergency-access')), false);
});

test('AUTH-SECRET-1: the middleware stops every request when the secret is missing', () => {
    const mw = readFileSync('src/middleware.ts', 'utf8');
    assert.match(mw, /export default async function middleware\(req: NextRequest\) \{\n\s+if \(!AUTH_SECRET\) return authNotConfigured\(req\);/);
});
