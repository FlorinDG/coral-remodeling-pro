import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAuditLogData,
    buildAuditLogOperation,
    resolveActorFromScope,
    type AuditScope,
    type AuditEvent
} from '../src/lib/audit.ts';

test('CORE-2 · USER actor: produces actorKind = USER, actorUserId, resolved actorLabel', async () => {
    const scope: AuditScope = {
        tenantId: 'tenant-1',
        userId: 'user-123',
        userName: 'Alice Smith',
        user: {
            id: 'user-123',
            name: 'Alice Smith',
            email: 'alice@example.com',
            role: 'ADMIN',
        }
    };

    const event: AuditEvent = {
        entityType: 'globalPage',
        entityId: 'page-1',
        action: 'accountant-export',
        field: 'accountantExportedAt',
        before: { accountantExportedAt: false },
        after: { accountantExportedAt: true },
        reason: 'Accountant export for Q2',
    };

    const data = await buildAuditLogData(scope, event);

    assert.equal(data.actorKind, 'USER');
    assert.equal(data.actorUserId, 'user-123');
    assert.equal(data.actorLabel, 'Alice Smith');
    assert.equal(data.actorRef, null);
    assert.equal(data.onBehalfOfId, null);
    assert.equal(data.tenantId, 'tenant-1');
    assert.equal(data.entityType, 'globalPage');
    assert.equal(data.entityId, 'page-1');
    assert.equal(data.action, 'accountant-export');
});

test('CORE-2 · PORTAL actor: actorUserId = null, actorKind = PORTAL, actorRef = portalId', async () => {
    const scope: AuditScope = {
        tenantId: 'tenant-1',
        portalId: 'portal-client-abc',
        portalName: 'Bob Client',
    };

    const event: AuditEvent = {
        entityType: 'document',
        entityId: 'doc-1',
        action: 'upload',
    };

    const data = await buildAuditLogData(scope, event);

    assert.equal(data.actorKind, 'PORTAL');
    assert.equal(data.actorUserId, null);
    assert.equal(data.actorRef, 'portal-client-abc');
    assert.equal(data.actorLabel, 'Bob Client');
    assert.equal(data.onBehalfOfId, null);
});

test('CORE-2 · SYSTEM actor: actorUserId = null, actorKind = SYSTEM, actorRef = jobName', async () => {
    const scope: AuditScope = {
        tenantId: 'tenant-1',
        jobName: 'invoice-overdue-cron',
    };

    const event: AuditEvent = {
        entityType: 'invoice',
        entityId: 'inv-123',
        action: 'mark-overdue',
        reason: 'Payment 30 days overdue',
    };

    const data = await buildAuditLogData(scope, event);

    assert.equal(data.actorKind, 'SYSTEM');
    assert.equal(data.actorUserId, null);
    assert.equal(data.actorRef, 'invoice-overdue-cron');
    assert.equal(data.actorLabel, 'System (invoice-overdue-cron)');
    assert.equal(data.onBehalfOfId, null);
});

test('CORE-2 · OPERATOR actor: records both operator and impersonated tenant user', async () => {
    const scope: AuditScope = {
        tenantId: 'tenant-1',
        user: {
            id: 'tenant-user-789',
            name: 'Client User',
            impersonating: true,
            impersonatedBy: 'superadmin-op-001',
        }
    };

    const event: AuditEvent = {
        entityType: 'clockEntry',
        entityId: 'ce-999',
        action: 'update',
    };

    const data = await buildAuditLogData(scope, event);

    assert.equal(data.actorKind, 'OPERATOR');
    assert.equal(data.actorUserId, 'superadmin-op-001');
    assert.equal(data.onBehalfOfId, 'tenant-user-789');
    assert.equal(data.actorRef, null);
    assert.equal(data.actorLabel, 'Operator impersonating');
});

test('CORE-2 · actorKind is required: buildAuditLogData always produces a valid non-empty actorKind', async () => {
    const scope: AuditScope = {
        tenantId: 'tenant-1',
        userId: 'fallback-user',
    };

    const event: AuditEvent = {
        entityType: 'clockEntry',
        entityId: 'ce-1',
        action: 'approve',
    };

    const data = await buildAuditLogData(scope, event);
    assert.ok(data.actorKind === 'USER' || data.actorKind === 'SYSTEM' || data.actorKind === 'PORTAL' || data.actorKind === 'OPERATOR');
    assert.ok(data.actorLabel.length > 0);
});

test('CORE-3 · buildAuditLogOperation is strictly synchronous and returns a PrismaPromise', () => {
    let createCalled = false;
    let receivedData: any = null;
    const sentinelPrismaPromise = {
        then: (onfulfilled?: any) => Promise.resolve('ok').then(onfulfilled),
        [Symbol.toStringTag]: 'PrismaPromise'
    };

    const stubPrisma = {
        auditLog: {
            create({ data }: { data: any }) {
                createCalled = true;
                receivedData = data;
                return sentinelPrismaPromise;
            }
        }
    };

    const auditData = {
        tenantId: 'tenant-1',
        actorKind: 'USER' as const,
        actorUserId: 'u1',
        actorRef: null,
        actorLabel: 'Alice',
        onBehalfOfId: null,
        entityType: 'clockEntry',
        entityId: 'ce-1',
        action: 'approve',
        field: null,
        before: null,
        after: null,
        reason: null,
    };

    const op = buildAuditLogOperation(stubPrisma, auditData);

    assert.equal(createCalled, true);
    assert.equal(receivedData, auditData);
    assert.equal(op, sentinelPrismaPromise);
    assert.equal(typeof (op as any).then, 'function');
    assert.ok(!(op instanceof Promise), 'Must be a direct PrismaPromise, not an async-wrapped Promise');
});

test('CORE-3 · $transaction accepts buildAuditLogOperation alongside other Prisma promises', async () => {
    const sentinelClockOp = {
        then: (fn: any) => Promise.resolve({ id: 'ce-1', status: 'approved' }).then(fn)
    };
    const sentinelAuditOp = {
        then: (fn: any) => Promise.resolve({ id: 'audit-1' }).then(fn)
    };

    const stubPrisma = {
        auditLog: {
            create: () => sentinelAuditOp
        },
        $transaction: async (ops: any[]) => {
            for (const op of ops) {
                // Mimic Prisma Client's strict check on $transaction array elements
                if (!op || typeof op.then !== 'function' || (op instanceof Promise && !Object.prototype.hasOwnProperty.call(op, 'then') && op.constructor.name === 'Promise')) {
                    throw new Error('All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma calls you intended to pass in the $transaction function.');
                }
            }
            return Promise.all(ops);
        }
    };

    const auditOp = buildAuditLogOperation(stubPrisma, {} as any);
    const results = await stubPrisma.$transaction([sentinelClockOp, auditOp]);

    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'approved');
    assert.equal(results[1].id, 'audit-1');
});
