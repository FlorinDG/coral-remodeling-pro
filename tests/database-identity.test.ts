/**
 * CHARACTERIZATION & INVARIANT TESTS — KERN-3 · mintDatabaseId (Identity Directive)
 *
 * Requirements (coder-run-4.md / pd.md IDENTITY DIRECTIVE):
 * 1. mintDatabaseId() is the authoritative source of a new database identifier.
 * 2. Identity is minted at the lowest layer that owns it and is immutable to everything above.
 * 3. A caller learns an identity; it never chooses one.
 * 4. specificId parameter is deleted from createDatabase.
 * 5. Unique, non-colliding UUID v4 identifiers.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mintDatabaseId } from '../src/lib/database-identity.ts';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('KERN-3 — mintDatabaseId (Identity Directive)', () => {
    test('mintDatabaseId() returns a valid UUID v4 format', () => {
        const id = mintDatabaseId();
        assert.ok(typeof id === 'string', 'id must be a string');
        assert.match(id, UUID_V4_REGEX, `"${id}" must match UUID v4 structure`);
    });

    test('mintDatabaseId() generates unique, non-colliding identifiers', () => {
        const ids = new Set<string>();
        const count = 100;
        for (let i = 0; i < count; i++) {
            const id = mintDatabaseId();
            assert.equal(ids.has(id), false, `Collision detected for id: ${id}`);
            ids.add(id);
        }
        assert.equal(ids.size, count);
    });

    test('mintDatabaseId() is a pure function that mints identity without caller input', () => {
        // A caller cannot choose or influence the minted ID — it takes 0 arguments
        assert.equal(mintDatabaseId.length, 0);
    });
});
