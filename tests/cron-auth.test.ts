import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronAuthorized } from '../src/lib/cron-auth.ts';

// R5-1: the one cron check is FAIL-CLOSED — a missing secret refuses everyone.

test('no CRON_SECRET configured → refused, whatever the request carries', () => {
    for (const secret of [undefined, '']) {
        assert.equal(cronAuthorized(secret, null, null), false);
        assert.equal(cronAuthorized(secret, 'Bearer ', null), false);
        assert.equal(cronAuthorized(secret, 'Bearer undefined', 'undefined'), false);
    }
});

test('the right Bearer header passes; a wrong or missing one is refused', () => {
    assert.equal(cronAuthorized('s3cret', 'Bearer s3cret', null), true);
    assert.equal(cronAuthorized('s3cret', 'Bearer wrong!', null), false);
    assert.equal(cronAuthorized('s3cret', 's3cret', null), false);          // no "Bearer "
    assert.equal(cronAuthorized('s3cret', null, null), false);
});

test('the query form passes only when the route allows it (the caller passes null otherwise)', () => {
    assert.equal(cronAuthorized('s3cret', null, 's3cret'), true);
    assert.equal(cronAuthorized('s3cret', null, 's3cre'), false);
});
