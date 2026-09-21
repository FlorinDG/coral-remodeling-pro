/**
 * CHARACTERIZATION & INVARIANT TESTS — NOTIF-1 / DI-1 Notification Service (L1)
 *
 * Requirements (coder-directive-di-notif.md / coral-notifications.md):
 * 1. notify() always writes in-app first and is the primary record.
 * 2. Unknown topic is rejected (no free-text type).
 * 3. Outcome fields are recorded (deliveryStatus, deliveryReason, channelOutcomes).
 * 4. Scope is required: { tenantId, db } passed explicitly; tenantId absent from NotifyParams.
 * 5. Entity normalization: accepts { type, id } or separate entity/entityId fields.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    notify,
    createNotification,
    NOTIFICATION_TOPICS,
    isValidTopic,
    type NotificationDbClient,
    type NotificationScope,
} from '../src/lib/notifications.ts';

class StubNotificationDb implements NotificationDbClient {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public createdNotifications: any[] = [];

    notification = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: async ({ data }: { data: any }) => {
            const record = {
                id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                ...data,
                readAt: null,
                createdAt: new Date(),
            };
            this.createdNotifications.push(record);
            return record;
        },
    };
}

describe('NOTIF-1 / DI-1 — Topic Validation & Taxonomy', () => {
    test('declares required namespaced topics', () => {
        const expected = [
            'quotes.accepted',
            'quotes.viewed',
            'invoices.paid',
            'invoices.overdue',
            'invoices.sent',
            'invoices.credit_note',
            'peppol.received',
            'tasks.reminder',
            'hr.shift',
        ];

        for (const t of expected) {
            assert.ok(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                NOTIFICATION_TOPICS.includes(t as any),
                `Topic "${t}" must be in NOTIFICATION_TOPICS`
            );
            assert.equal(isValidTopic(t), true);
        }
    });

    test('an unknown topic is rejected and no in-app record is created', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        await assert.rejects(
            async () => {
                await notify(
                    {
                        userId: 'usr_assignee',
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        topic: 'random.unregistered' as any,
                        title: 'Test',
                        body: 'Test body',
                        entity: { type: 'quote', id: 'q_1' },
                        href: '/quotes/q_1',
                    },
                    scope
                );
            },
            {
                name: 'Error',
                message: /Unknown notification topic: "random\.unregistered"/,
            }
        );

        // Verification: in-app was not written on rejection
        assert.equal(db.createdNotifications.length, 0);
    });

    test('rejects empty or free-text legacy type', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        await assert.rejects(async () => {
            await notify(
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    topic: 'FREE_TEXT_TYPE' as any,
                    title: 'Test',
                    body: 'Test body',
                    entity: { type: 'invoice', id: 'inv_1' },
                    href: '/invoices/inv_1',
                },
                scope
            );
        });
    });
});

describe('NOTIF-1 / DI-1 — notify() In-app Write & Scope Handling', () => {
    test('notify() writes in-app first using scope.tenantId and returns record', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        const result = await notify(
            {
                userId: 'usr_assignee_1',
                topic: 'quotes.accepted',
                title: 'Quote Accepted',
                body: 'Quote OFF-2026-001 accepted by John',
                entity: { type: 'quote', id: 'q_123' },
                href: '/nl/admin/database/db-quotations/q_123',
            },
            scope
        );

        // Record must be created
        assert.equal(db.createdNotifications.length, 1);
        const record = db.createdNotifications[0];

        assert.equal(record.tenantId, 'tenant_1');
        assert.equal(record.userId, 'usr_assignee_1');
        assert.equal(record.type, 'quotes.accepted');
        assert.equal(record.title, 'Quote Accepted');
        assert.equal(record.body, 'Quote OFF-2026-001 accepted by John');
        assert.equal(record.entityType, 'quote');
        assert.equal(record.entityId, 'q_123');
        assert.equal(record.href, '/nl/admin/database/db-quotations/q_123');

        assert.equal(result.notification.id, record.id);
    });

    test('delivery outcome fields are explicitly recorded as delivered against in-app (NOTIF-3)', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        const result = await notify(
            {
                userId: 'usr_assignee_2',
                topic: 'invoices.overdue',
                title: 'Invoice Overdue',
                body: 'Invoice INV-2026-004 is overdue',
                entity: { type: 'invoice', id: 'inv_456' },
                href: '/nl/admin/database/db-invoices/inv_456',
            },
            scope
        );

        // Verification: outcome fields on record
        const record = db.createdNotifications[0];
        assert.equal(record.deliveryStatus, 'delivered');
        assert.equal(record.deliveryReason, null);
        assert.ok(record.channelOutcomes);
        assert.equal(record.channelOutcomes.in_app.status, 'delivered');
        assert.equal(record.channelOutcomes.in_app.reason, null);
        assert.ok(record.channelOutcomes.in_app.at);

        // Verification: outcome fields in return value
        assert.equal(result.deliveryStatus, 'delivered');
        assert.equal(result.channelOutcomes.in_app.status, 'delivered');
    });

    test('throws if scope is missing or incomplete (DI-1 required scope)', async () => {
        await assert.rejects(
            async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await notify({
                    userId: null,
                    topic: 'peppol.received',
                    title: 'Peppol Invoice',
                    body: 'Received',
                    entity: { type: 'invoice', id: 'inv_peppol' },
                    href: '/expenses',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any, null as any);
            },
            {
                name: 'Error',
                message: /Notification requires a valid scope with tenantId and db client/,
            }
        );
    });

    test('normalizes entity: handles both object {type, id} and separate fields', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        await notify(
            {
                userId: 'usr_1',
                topic: 'invoices.paid',
                title: 'Invoice Paid',
                body: 'Paid in full',
                entity: 'invoice',
                entityId: 'inv_separate_fields',
                href: '/invoices/inv_separate_fields',
            },
            scope
        );

        assert.equal(db.createdNotifications[0].entityType, 'invoice');
        assert.equal(db.createdNotifications[0].entityId, 'inv_separate_fields');
    });

    test('throws if entity is missing or incomplete', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        await assert.rejects(async () => {
            await notify(
                {
                    topic: 'invoices.paid',
                    title: 'Invoice Paid',
                    body: 'Paid in full',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    entity: '' as any,
                    href: '/invoices',
                },
                scope
            );
        });
    });
});

describe('NOTIF-1 / DI-1 — createNotification backward compatibility wrapper', () => {
    test('maps legacy uppercase topic to namespaced topic and creates record through scope', async () => {
        const db = new StubNotificationDb();
        const scope: NotificationScope = { tenantId: 'tenant_1', db };

        const record = await createNotification(
            {
                userId: 'usr_assignee',
                type: 'QUOTE_ACCEPTED',
                title: 'Legacy Quote Accepted',
                body: 'Accepted',
                entityType: 'quote',
                entityId: 'q_legacy',
                href: '/quotes/q_legacy',
            },
            scope
        );

        assert.equal(record.type, 'quotes.accepted');
        assert.equal(record.deliveryStatus, 'delivered');
        assert.equal(db.createdNotifications.length, 1);
        assert.equal(db.createdNotifications[0].tenantId, 'tenant_1');
    });
});
