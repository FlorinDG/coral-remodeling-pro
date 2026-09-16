import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExportLock, isWipeHazard } from '../src/lib/records/export-lock.ts';

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

test('checkExportLock: locked + receiptUrl changed → allowed', () => {
    const existing = { title: 'Fixed Title', receiptUrl: 'old-key.pdf', accountantExportedAt: true };
    const incoming = { receiptUrl: 't_tenant1/documents/db-invoices/p1/doc-v1.pdf' };
    const relations = new Set<string>();

    const result = checkExportLock(existing, incoming, relations);
    assert.equal(result, null);
});

test('checkExportLock: locked + documentReconstructed fields changed → allowed', () => {
    const existing = { title: 'Fixed Title', accountantExportedAt: true };
    const incoming = {
        documentReconstructed: true,
        documentReconstructedAt: '2026-09-12T15:00:00.000Z'
    };
    const relations = new Set<string>();

    const result = checkExportLock(existing, incoming, relations);
    assert.equal(result, null);
});

test('checkExportLock: locked + archive fields AND ordinary field changed → blocks only ordinary field', () => {
    const existing = { title: 'Old Title', receiptUrl: 'old.pdf', accountantExportedAt: true };
    const incoming = {
        title: 'New Title',
        receiptUrl: 'new.pdf',
        documentReconstructed: true,
        documentReconstructedAt: '2026-09-12T15:00:00.000Z'
    };
    const relations = new Set<string>();

    const result = checkExportLock(existing, incoming, relations);
    assert.notEqual(result, null);
    assert.deepEqual(result?.blockedFields, ['title']);
});

test('checkExportLock: locked + blocks omitted (undefined) → allowed (R1)', () => {
    const existing = { title: 'Same Title', accountantExportedAt: true };
    const incoming = { title: 'Same Title' };
    const existingBlocks = [{ id: 'b1', type: 'financial-row', quantity: 2, unitPrice: 100 }];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, undefined);
    assert.equal(result, null);
});

test('checkExportLock: locked + blocks identical → allowed', () => {
    const existing = { title: '2026-55', accountantExportedAt: true };
    const incoming = { title: '2026-55' };
    const existingBlocks = [{ id: 'b1', type: 'financial-row', content: 'Wall paint', quantity: 2, unitPrice: 100 }];
    const incomingBlocks = [{ id: 'b1', type: 'financial-row', content: 'Wall paint', quantity: 2, unitPrice: 100 }];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, incomingBlocks);
    assert.equal(result, null);
});

test('checkExportLock: locked + volatile UI state changed on blocks → allowed without over-blocking (R1)', () => {
    const existing = { title: '2026-55', accountantExportedAt: true };
    const incoming = { title: '2026-55' };
    const existingBlocks = [{ id: 'b1', type: 'financial-row', content: 'Wall paint', quantity: 2, unitPrice: 100, isParentCollapsed: false }];
    // incoming has different key order and isParentCollapsed: true
    const incomingBlocks = [{ isParentCollapsed: true, unitPrice: 100, quantity: 2, content: 'Wall paint', id: 'b1', type: 'financial-row' }];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, incomingBlocks);
    assert.equal(result, null, 'Volatile UI keys like isParentCollapsed or key order must not trigger lock refusal');
});

test('checkExportLock: locked + line item quantity/price edited → violation naming blocks (LOCK-1)', () => {
    const existing = { title: '2026-55', accountantExportedAt: true };
    const incoming = { title: '2026-55' };
    const existingBlocks = [{ id: 'b1', type: 'financial-row', content: 'Wall paint', quantity: 2, unitPrice: 100 }];
    const incomingBlocks = [{ id: 'b1', type: 'financial-row', content: 'Wall paint', quantity: 5, unitPrice: 100 }];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, incomingBlocks);
    assert.notEqual(result, null);
    assert.deepEqual(result?.blockedFields, ['blocks']);
});

test('checkExportLock: locked + line item added/deleted → violation naming blocks', () => {
    const existing = { title: '2026-55', accountantExportedAt: true };
    const incoming = { title: '2026-55' };
    const existingBlocks = [{ id: 'b1', type: 'financial-row', content: 'Line 1' }];
    const incomingBlocks = [
        { id: 'b1', type: 'financial-row', content: 'Line 1' },
        { id: 'b2', type: 'financial-row', content: 'Line 2' }
    ];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, incomingBlocks);
    assert.notEqual(result, null);
    assert.deepEqual(result?.blockedFields, ['blocks']);
});

test('checkExportLock: locked + both property and line item edited → violation naming both', () => {
    const existing = { title: '2026-55', vatRegime: '21', accountantExportedAt: true };
    const incoming = { title: '2026-55', vatRegime: '6' };
    const existingBlocks = [{ id: 'b1', quantity: 1 }];
    const incomingBlocks = [{ id: 'b1', quantity: 2 }];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, incomingBlocks);
    assert.notEqual(result, null);
    assert.deepEqual(result?.blockedFields, ['vatRegime', 'blocks']);
});

test('checkExportLock: not locked + line items edited → allowed', () => {
    const existing = { title: '2026-55', accountantExportedAt: false };
    const incoming = { title: '2026-55' };
    const existingBlocks = [{ id: 'b1', quantity: 1 }];
    const incomingBlocks = [{ id: 'b1', quantity: 99 }];

    const result = checkExportLock(existing, incoming, new Set(), existingBlocks, incomingBlocks);
    assert.equal(result, null);
});

test('R1 safeguard: server has 3 blocks, incoming is [] on NON-exported record → wipe hazard detected', () => {
    const existingBlocks = [
        { id: 'b1', content: 'Item 1' },
        { id: 'b2', content: 'Item 2' },
        { id: 'b3', content: 'Item 3' }
    ];
    const incomingBlocks: unknown[] = [];

    // Must detect hazard and refuse to silently wipe
    assert.equal(isWipeHazard(existingBlocks, incomingBlocks), true);

    // If incoming is omitted (undefined), it is NOT a wipe hazard
    assert.equal(isWipeHazard(existingBlocks, undefined), false);

    // If server has no blocks, incoming [] is not a wipe hazard
    assert.equal(isWipeHazard([], incomingBlocks), false);
});



