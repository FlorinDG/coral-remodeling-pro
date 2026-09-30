/**
 * R1-4 — the scoped client's argument rewrite (pure). A crafted request must not reach another
 * tenant by any operation: read, by-id update/delete, create, createMany, upsert.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scopeArgs, TenantMismatchError } from '../src/lib/data/scope-args.ts';
import { UnclassifiedModelError, PlatformModelError } from '../src/lib/data/scope-rules.ts';

const T = 'tenant-A';

describe('reads and by-id writes carry the scope', () => {
    test('findUnique by id on a direct model is tenant-scoped', () => {
        const { args } = scopeArgs('Invoice', 'findUnique', { where: { id: 'inv-1' } }, T);
        assert.deepEqual(args.where, { id: 'inv-1', tenantId: T });
    });
    test('delete by id on a via model goes through the parent', () => {
        const { args } = scopeArgs('GlobalPage', 'delete', { where: { id: 'p1' } }, T);
        assert.deepEqual(args.where, { id: 'p1', database: { tenantId: T } });
    });
    test('updateMany cannot widen to another tenant', () => {
        const { args } = scopeArgs('Invoice', 'updateMany', { where: { tenantId: 'tenant-B' }, data: { status: 'x' } }, T);
        assert.equal((args.where as { tenantId: string }).tenantId, T);
    });
    test('a findMany with no where still gets the tenant', () => {
        assert.deepEqual(scopeArgs('ClockEntry', 'findMany', undefined, T).args.where, { tenantId: T });
    });
});

describe('creates', () => {
    test('direct: tenantId injected', () => {
        const { args } = scopeArgs('Invoice', 'create', { data: { number: '1' } }, T);
        assert.equal((args.data as { tenantId: string }).tenantId, T);
    });
    test('direct: another tenant refused', () => {
        assert.throws(() => scopeArgs('Invoice', 'create', { data: { tenantId: 'tenant-B' } }, T), TenantMismatchError);
        assert.throws(() => scopeArgs('Invoice', 'create', { data: { tenant: { connect: { id: 'tenant-B' } } } }, T), TenantMismatchError);
    });
    test('via: the parent must be named, and is returned for verification', () => {
        const r = scopeArgs('GlobalPage', 'create', { data: { databaseId: 'db-x', properties: {} } }, T);
        assert.deepEqual(r.verifyParents, [{ parent: 'GlobalDatabase', id: 'db-x' }]);
        const c = scopeArgs('ShiftTask', 'create', { data: { shift: { connect: { id: 's1' } }, taskId: 't' } }, T);
        assert.deepEqual(c.verifyParents, [{ parent: 'ScheduledShift', id: 's1' }]);
        assert.throws(() => scopeArgs('GlobalPage', 'create', { data: { properties: {} } }, T), TenantMismatchError);
    });
    test('via: a nested create of the parent is refused', () => {
        assert.throws(() => scopeArgs('GlobalPage', 'create', { data: { database: { create: { name: 'x' } } } }, T), TenantMismatchError);
    });
    test('createMany: every row checked, parents de-duplicated', () => {
        const r = scopeArgs('GlobalPage', 'createMany', { data: [{ databaseId: 'd1' }, { databaseId: 'd1' }, { databaseId: 'd2' }] }, T);
        assert.equal(r.verifyParents.length, 2);
    });
});

describe('updates and upsert', () => {
    test('direct: an update cannot move a row to another tenant', () => {
        assert.throws(() => scopeArgs('Invoice', 'update', { where: { id: 'i' }, data: { tenantId: 'tenant-B' } }, T), TenantMismatchError);
    });
    test('via: moving a row to another parent verifies that parent', () => {
        const r = scopeArgs('GlobalPage', 'update', { where: { id: 'p' }, data: { databaseId: 'db-other' } }, T);
        assert.deepEqual(r.verifyParents, [{ parent: 'GlobalDatabase', id: 'db-other' }]);
    });
    test('upsert: where scoped, create prepared', () => {
        const r = scopeArgs('Invoice', 'upsert', { where: { id: 'i' }, create: { number: '1' }, update: { number: '2' } }, T);
        assert.deepEqual(r.args.where, { id: 'i', tenantId: T });
        assert.equal((r.args.create as { tenantId: string }).tenantId, T);
    });
});

describe('fails closed', () => {
    test('platform and unknown models throw', () => {
        assert.throws(() => scopeArgs('Tenant', 'findMany', {}, T), PlatformModelError);
        assert.throws(() => scopeArgs('Nope', 'findMany', {}, T), UnclassifiedModelError);
    });
    test('no tenant throws', () => {
        assert.throws(() => scopeArgs('Invoice', 'findMany', {}, ''));
    });
});
