import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabaseId, UnboundSystemDatabaseError } from '../src/lib/kernel/system-databases.ts';

const bound = { invoices: 'db-invoices-abc12345', tasks: 'db-tasks-abc12345', clients: 'db-clients' };

test('a system base resolves through the binding', () => {
    assert.equal(resolveDatabaseId('db-invoices', bound), 'db-invoices-abc12345');
    assert.equal(resolveDatabaseId('db-clients', bound), 'db-clients'); // a legacy bare binding is still a READ binding
});

test('an unbound system base THROWS — no guessed suffix, no bare-id fallback', () => {
    assert.throws(() => resolveDatabaseId('db-expenses', bound), UnboundSystemDatabaseError);
    assert.throws(() => resolveDatabaseId('db-invoices', {}), /unbound_system_database/);
    // getLockedDbId returned 'db-expenses-abc12345' here (invented from a sibling) — the fail-open this removes.
});

test('an already-bound id or a custom database id passes through unchanged', () => {
    assert.equal(resolveDatabaseId('db-invoices-abc12345', bound), 'db-invoices-abc12345');
    assert.equal(resolveDatabaseId('b3f1c2e0-custom', bound), 'b3f1c2e0-custom');
});
