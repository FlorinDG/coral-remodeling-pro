import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAuditLogData,
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
