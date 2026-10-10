/**
 * CRM-SCOPE-1 · the CRM server actions were PUBLIC (no session check) and wrote by id on the raw client — anyone could
 * change or delete any tenant's leads / bookings. Server actions are endpoints: every exported one must check the
 * session and act on the scoped client.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/app/actions/crm.ts', import.meta.url), 'utf8');

test('no lead / booking is read or written on the raw client', () => {
    assert.doesNotMatch(src, /prisma\.(lead|booking)\./);
});

test('every lead / booking action opens the session scope (crmScope) before anything else', () => {
    const actions = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)]
        .filter(m => /Lead|Booking/.test(m[1]));
    assert.equal(actions.length, 6);
    for (const [, name, body] of actions) {
        const first = body.trim().split('\n')[0];
        assert.match(first, /const db = await crmScope\(\);/, `${name} must start with the scope check`);
        assert.match(body, /if \(!db\) return \{ success: false, error: 'Unauthorized' \}/, `${name} must refuse without a scope`);
    }
    assert.match(src, /isWorkforceRole/);
    assert.match(src, /scopeFromSession\(\)/);
});
