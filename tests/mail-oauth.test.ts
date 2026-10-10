/**
 * MAIL-OAUTH-1 · the Gmail connection belongs to the signed-in tenant. The OAuth `state` was the raw tenant id and the
 * callback trusted it (no session): finishing Google's consent with another tenant's id attached a mailbox to THAT
 * tenant; and the upsert by email moved a mailbox from another tenant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const start = read('app/api/email/connect/google/route.ts');
const callback = read('app/api/email/connect/google/callback/route.ts');

test('the state is a one-time nonce in an httpOnly cookie — never the tenant id', () => {
    assert.doesNotMatch(start, /state:\s*session\.user\.tenantId/);
    assert.match(start, /const state = randomUUID\(\)/);
    assert.match(start, /cookies\.set\(OAUTH_STATE_COOKIE, state, \{ httpOnly: true/);
});

test('the callback takes the tenant from its session, checks the nonce, and never moves another tenant\'s mailbox', () => {
    assert.doesNotMatch(callback, /tenantId = searchParams\.get/);
    assert.match(callback, /const tenantId = session\?\.user\?\.tenantId/);
    assert.match(callback, /timingSafeEqual\(a, b\)/);
    assert.match(callback, /already\.tenantId !== tenantId/);
    assert.ok(callback.indexOf('timingSafeEqual(a, b)') < callback.indexOf('getToken(code)'), 'the nonce is checked before the code is exchanged');
});

test('route files export only handlers here — the helpers live in lib/mail', () => {
    assert.doesNotMatch(start, /export (function|const) (getGmailOAuth2Client|OAUTH_STATE_COOKIE)/);
});
