/**
 * CHARACTERIZATION & INVARIANT TESTS — NOTIF-1 Notification Service (L1)
 *
 * Requirements (coder-run-4.md / coral-notifications.md):
 * 1. notify() always writes in-app first and is the primary record.
 * 2. Unknown topic is rejected (no free-text type).
 * 3. Outcome fields are recorded (deliveryStatus, deliveryReason, channelOutcomes).
 * 4. Assignee only: userId target is preserved, tenantId resolved if omitted.
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
    type NotificationTopic,
} from '../src/lib/notifications.ts';

class StubNotificationDb implements NotificationDbClient {
    public createdNotifications: any[] = [];
    public users = new Map<string, { id: string; tenantId: string }>();

    notification = {
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

    user = {
        findUnique: async ({ where }: { where: { id: string } }) => {
            return this.users.get(where.id) || null;
        },
    };
}

describe('NOTIF-1 — Topic Validation & Taxonomy', () => {
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
                NOTIFICATION_TOPICS.includes(t as any),
                `Topic "${t}" must be in NOTIFICATION_TOPICS`
            );
            assert.equal(isValidTopic(t), true);
        }
    });

    test('an unknown topic is rejected and no in-app record is created', async () => {
        const db = new StubNotificationDb();

        await assert.rejects(
            async () => {
                await notify(
                    {
                        tenantId: 'tenant_1',
                        userId: 'usr_assignee',
                        topic: 'random.unregistered' as any,
                        title: 'Test',
                        body: 'Test body',
                        entity: { type: 'quote', id: 'q_1' },
                        href: '/quotes/q_1',
                    },
                    db
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

        await assert.rejects(async () => {
            await notify(
                {
                    tenantId: 'tenant_1',
                    topic: 'FREE_TEXT_TYPE' as any,
                    title: 'Test',
                    body: 'Test body',
                    entity: { type: 'invoice', id: 'inv_1' },
                    href: '/invoices/inv_1',
                },
                db
            );
        });
    });
});

describe('NOTIF-1 — notify() In-app Write & Delivery Outcome Log', () => {
    test('notify() always writes in-app first and returns record', async () => {
        const db = new StubNotificationDb();

        const result = await notify(
            {
                tenantId: 'tenant_1',
                userId: 'usr_assignee_1',
                topic: 'quotes.accepted',
                title: 'Quote Accepted',
                body: 'Quote OFF-2026-001 accepted by John',
                entity: { type: 'quote', id: 'q_123' },
                href: '/nl/admin/database/db-quotations/q_123',
            },
            db
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

    test('delivery outcome fields are recorded against the notification', async () => {
        const db = new StubNotificationDb();

        const result = await notify(
            {
                tenantId: 'tenant_1',
                userId: 'usr_assignee_2',
                topic: 'invoices.overdue',
                title: 'Invoice Overdue',
                body: 'Invoice INV-2026-004 is overdue',
                entity: { type: 'invoice', id: 'inv_456' },
                href: '/nl/admin/database/db-invoices/inv_456',
            },
            db
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

    test('assignee only: userId target is preserved and tenantId resolved if omitted', async () => {
        const db = new StubNotificationDb();
        db.users.set('usr_flor', { id: 'usr_flor', tenantId: 'tenant_coral' });

        const result = await notify(
            {
                userId: 'usr_flor', // tenantId omitted, should resolve from assignee
                topic: 'tasks.reminder',
                title: 'Task Reminder',
                body: 'Reminder for Site Visit',
                entity: { type: 'page', id: 'page_site' },
                href: '/tasks/page_site',
            },
            db
        );

        assert.equal(result.notification.tenantId, 'tenant_coral');
        assert.equal(result.notification.userId, 'usr_flor');
    });

    test('throws if tenantId cannot be resolved', async () => {
        const db = new StubNotificationDb();

        await assert.rejects(
            async () => {
                await notify(
                    {
                        userId: null,
                        topic: 'peppol.received',
                        title: 'Peppol Invoice',
                        body: 'Received',
                        entity: { type: 'invoice', id: 'inv_peppol' },
                        href: '/expenses',
                    },
                    db
                );
            },
            {
                name: 'Error',
                message: /Cannot send notification: tenantId could not be resolved/,
            }
        );
    });

    test('normalizes entity: handles both object {type, id} and separate fields', async () => {
        const db = new StubNotificationDb();

        await notify(
            {
                tenantId: 'tenant_1',
                userId: 'usr_1',
                topic: 'invoices.paid',
                title: 'Invoice Paid',
                body: 'Paid in full',
                entity: 'invoice',
                entityId: 'inv_separate_fields',
                href: '/invoices/inv_separate_fields',
            },
            db
        );

        assert.equal(db.createdNotifications[0].entityType, 'invoice');
        assert.equal(db.createdNotifications[0].entityId, 'inv_separate_fields');
    });

    test('throws if entity is missing or incomplete', async () => {
        const db = new StubNotificationDb();

        await assert.rejects(async () => {
            await notify(
                {
                    tenantId: 'tenant_1',
                    topic: 'invoices.paid',
                    title: 'Invoice Paid',
                    body: 'Paid in full',
                    entity: '' as any,
                    href: '/invoices',
                },
                db
            );
        });
    });
});

describe('NOTIF-1 — createNotification backward compatibility wrapper', () => {
    test('maps legacy uppercase topic to namespaced topic and creates record', async () => {
        const db = new StubNotificationDb();

        const record = await createNotification(
            {
                tenantId: 'tenant_1',
                userId: 'usr_assignee',
                type: 'QUOTE_ACCEPTED',
                title: 'Legacy Quote Accepted',
                body: 'Accepted',
                entityType: 'quote',
                entityId: 'q_legacy',
                href: '/quotes/q_legacy',
            },
            db
        );

        assert.equal(record.type, 'quotes.accepted');
        assert.equal(record.deliveryStatus, 'delivered');
        assert.equal(db.createdNotifications.length, 1);
    });
});
