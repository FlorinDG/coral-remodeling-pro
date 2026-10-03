import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNumber, nextVersion } from '../src/lib/records/quote-version.ts';

test('the base number drops a -vN suffix only', () => {
    assert.equal(baseNumber('OFF-2026-042'), 'OFF-2026-042');
    assert.equal(baseNumber('OFF-2026-042-v3'), 'OFF-2026-042');
    assert.equal(baseNumber('OFF-v2-2026'), 'OFF-v2-2026');
});

test('first revision is v2; then the highest existing + 1, whatever the order', () => {
    assert.equal(nextVersion('OFF-2026-042', ['OFF-2026-042']), 2);
    assert.equal(nextVersion('OFF-2026-042', ['OFF-2026-042', 'OFF-2026-042-v3', 'OFF-2026-042-v2']), 4);
    assert.equal(nextVersion('OFF-2026-042', ['OFF-2026-0420-v9']), 2);     // another number is not a sibling
});
