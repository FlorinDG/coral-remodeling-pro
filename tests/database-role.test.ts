import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseRoleOf, playsSystemRole } from '../src/lib/kernel/system-databases.ts';

const bound = { projects: 'db-1-t9', articles: 'db-articles-t9' };

test('a bound id plays its role by the binding (the comparison `id === "db-articles"` never matched this)', () => {
    assert.equal(databaseRoleOf('db-articles-t9', bound), 'articles');
    assert.equal(playsSystemRole('db-articles-t9', 'db-articles', bound), true);
    assert.equal(playsSystemRole('db-1-t9', 'db-1', bound), true);
    assert.equal(playsSystemRole('db-1-t9', 'projects', bound), true);
});

test('a legacy base is its own role; a custom database is none', () => {
    assert.equal(databaseRoleOf('db-1', {}), 'projects');
    assert.equal(databaseRoleOf('db-custom-77', bound), null);
    assert.equal(playsSystemRole('db-custom-77', 'db-articles', bound), false);
});

test('never parsed from the id shape: an unbound look-alike is NOT the role (throw proof for a prefix guess)', () => {
    assert.equal(databaseRoleOf('db-articles-OTHER', bound), null);
    assert.equal(playsSystemRole('db-1-OTHER', 'db-1', bound), false);
});

test('the database\'s own logicalKey is read when the binding does not name it', () => {
    assert.equal(databaseRoleOf('uuid-1', {}, id => (id === 'uuid-1' ? 'expenses' : null)), 'expenses');
    assert.equal(databaseRoleOf('uuid-1', {}, () => 'not-a-role'), null);
    assert.equal(playsSystemRole('uuid-1', 'db-articles', {}, () => 'expenses'), false);
});
