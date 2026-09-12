import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExportLock } from '../src/lib/records/export-lock.ts';

test('checkExportLock: not locked → always allowed', () => {
    const existing = { title: 'Old Title', amount: 100, accountantExportedAt: false };
    const incoming = { title: 'New Title', amount: 200 };
    const relations = new Set<string>(['relationProp']);

    const result = checkExportLock(existing, incoming, relations);
    assert.equal(result, null);
});

test('checkExportLock: existingProperties null/undefined → allowed', () => {
    const incoming = { title: 'New Title' };
    const relations = new Set<string>();

    assert.equal(checkExportLock(null, incoming, relations), null);
    assert.equal(checkExportLock(undefined as any, incoming, relations), null);
});

test('checkExportLock: locked + ordinary field changed → violation naming the field', () => {
    const existing = { title: 'Old Title', amount: 100, accountantExportedAt: true };
    const incoming = { title: 'New Title', amount: 100 };
    const relations = new Set<string>(['relationProp']);

    const result = checkExportLock(existing, incoming, relations);
    assert.notEqual(result, null);
    assert.deepEqual(result?.blockedFields, ['title']);
});

test('checkExportLock: locked + multiple ordinary fields changed → violation naming all changed fields', () => {
    const existing = { title: 'Old Title', amount: 100, description: 'Old', accountantExportedAt: true };
    const incoming = { title: 'New Title', amount: 200, description: 'Old' };
    const relations = new Set<string>();

    const result = checkExportLock(existing, incoming, relations);
    assert.notEqual(result, null);
    assert.deepEqual(result?.blockedFields, ['title', 'amount']);
});

test('checkExportLock: locked + only accountantExportedAt changed → allowed', () => {
    const existing = { title: 'Fixed Title', accountantExportedAt: true };
    const incoming = { accountantExportedAt: false };
    const relations = new Set<string>();

    const result = checkExportLock(existing, incoming, relations);
    assert.equal(result, null);
});

test('checkExportLock: locked + relation changed → allowed', () => {
    const existing = { title: 'Fixed Title', clientRel: ['client-1'], accountantExportedAt: true };
    const incoming = { clientRel: ['client-1', 'client-2'] };
    const relations = new Set<string>(['clientRel']);

    const result = checkExportLock(existing, incoming, relations);
    assert.equal(result, null);
});

test('checkExportLock: locked + field present but unchanged → allowed', () => {
    const existing = { title: 'Same Title', amount: 100, accountantExportedAt: true };
    const incoming = { title: 'Same Title', amount: 100 };
    const relations = new Set<string>();

    const result = checkExportLock(existing, incoming, relations);
    assert.equal(result, null);
});
