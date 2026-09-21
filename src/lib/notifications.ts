/**
 * NOTIFICATION TOPICS — Declared taxonomy in one place (NOTIF-1 / coral-notifications.md)
 * No free-text type allowed.
 */
export const NOTIFICATION_TOPICS = [
    'quotes.accepted',
    'quotes.viewed',
    'invoices.paid',
    'invoices.overdue',
    'invoices.sent',
    'invoices.credit_note',
    'peppol.received',
    'tasks.reminder',
    'hr.shift',
] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

export function isValidTopic(topic: string): topic is NotificationTopic {
    return (NOTIFICATION_TOPICS as readonly string[]).includes(topic);
}

export type DeliveryStatus = 'attempted' | 'delivered' | 'denied' | 'failed' | 'Dispatched';

export interface ChannelDeliveryOutcome {
    status: DeliveryStatus;
    reason?: string | null;
    at: string;
}

export interface ChannelOutcomes {
    in_app: ChannelDeliveryOutcome;
    push?: ChannelDeliveryOutcome;
    sms?: ChannelDeliveryOutcome;
    email?: ChannelDeliveryOutcome;
    [channel: string]: ChannelDeliveryOutcome | undefined;
}

export interface NotifyEntity {
    type: string;
    id: string;
}

export interface NotifyParams {
    /** Target assignee (Florin, 2026-09-21: Assignee only. Not the owner, not the tenant). */
    userId?: string | null;
    topic: NotificationTopic;
    title: string;
    body: string;
    /** Either an object `{ type, id }` or a type string (with `entityId` provided). */
    entity: NotifyEntity | string;
    entityId?: string;
    href: string;
    /** Optional channel hints (transports and registry land in R1; in-app is always true). */
    channels?: string[];
}

export interface NotificationDbClient {
    notification: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: (args: any) => Promise<any>;
    };
}

/**
 * The Notification Scope (DI-1 / R1-4 seam).
 * The caller supplies the resolved tenantId and data client.
 * After R1-4, this will be the TenantScopedClient directly.
 */
export interface NotificationScope {
    tenantId: string;
    db: NotificationDbClient;
}

/**
 * L1 Notification Service (NOTIF-1 / DI-1)
 *
 * In-app is ALWAYS written first and is the primary record of truth.
 * Outcome fields (deliveryStatus, deliveryReason, channelOutcomes) are recorded on the Notification row.
 * Tenant is read off scope.tenantId; notify() performs no tenancy resolution.
 */
export async function notify(
    params: NotifyParams,
    scope: NotificationScope
) {
    if (!scope || !scope.tenantId || !scope.db) {
        throw new Error('Notification requires a valid scope with tenantId and db client.');
    }

    const { topic, title, body, href } = params;

    // Topic validation — unknown topic is rejected (no free-text types)
    if (!topic || !isValidTopic(topic)) {
        throw new Error(
            `Unknown notification topic: "${topic}". Declared topics are: ${NOTIFICATION_TOPICS.join(', ')}`
        );
    }

    // Entity normalization
    let entityType: string;
    let entityId: string;

    if (typeof params.entity === 'object' && params.entity !== null) {
        entityType = params.entity.type;
        entityId = params.entity.id;
    } else {
        entityType = params.entity;
        entityId = params.entityId || '';
    }

    if (!entityType || !entityId) {
        throw new Error(`Notification requires a valid entity (type and id). Received type="${entityType}", id="${entityId}"`);
    }

    const userId = params.userId ?? null;

    // Delivery outcomes: In-app is written first and is always explicitly 'delivered' (NOTIF-3)
    const nowIso = new Date().toISOString();
    const channelOutcomes: ChannelOutcomes = {
        in_app: {
            status: 'delivered',
            reason: null,
            at: nowIso,
        },
    };

    const record = await scope.db.notification.create({
        data: {
            tenantId: scope.tenantId,
            userId, // Assignee only
            type: topic, // type column carries the namespaced topic
            title,
            body,
            entityType,
            entityId,
            href,
            deliveryStatus: 'delivered', // Explicitly delivered for in-app primary record (NOTIF-3)
            deliveryReason: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            channelOutcomes: channelOutcomes as any,
        },
    });

    return {
        notification: record,
        deliveryStatus: 'delivered' as DeliveryStatus,
        channelOutcomes,
    };
}

// Legacy topic mapping for backward compatibility during migration
const LEGACY_TOPIC_MAP: Record<string, NotificationTopic> = {
    QUOTE_ACCEPTED: 'quotes.accepted',
    QUOTE_VIEWED: 'quotes.viewed',
    INVOICE_PAID: 'invoices.paid',
    INVOICE_OVERDUE: 'invoices.overdue',
    INVOICE_SENT: 'invoices.sent',
    CREDIT_NOTE: 'invoices.credit_note',
    PEPPOL_RECEIVED: 'peppol.received',
    DATE_REMINDER: 'tasks.reminder',
};

export type NotificationType = NotificationTopic;

export interface CreateNotificationParams {
    userId?: string | null;
    type: NotificationTopic | string;
    title: string;
    body: string;
    entityType: 'quote' | 'invoice' | 'project' | string;
    entityId: string;
    href: string;
}

/**
 * @deprecated Use `notify({ userId, topic, title, body, entity, href }, scope)` instead.
 */
export async function createNotification(
    params: CreateNotificationParams,
    scope: NotificationScope
) {
    const topic = (LEGACY_TOPIC_MAP[params.type] || params.type) as NotificationTopic;
    return (
        await notify(
            {
                userId: params.userId,
                topic,
                title: params.title,
                body: params.body,
                entity: {
                    type: params.entityType,
                    id: params.entityId,
                },
                href: params.href,
            },
            scope
        )
    ).notification;
}
