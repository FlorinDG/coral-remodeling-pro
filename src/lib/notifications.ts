import prisma from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

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

export type DeliveryStatus = 'attempted' | 'delivered' | 'denied' | 'failed';

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
    tenantId?: string;
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
        create: (args: any) => Promise<any>;
    };
    user?: {
        findUnique: (args: any) => Promise<any>;
    };
}

/**
 * L1 Notification Service (NOTIF-1)
 *
 * In-app is ALWAYS written first and is the primary record of truth.
 * Outcome fields (deliveryStatus, deliveryReason, channelOutcomes) are recorded on the Notification row.
 */
export async function notify(
    params: NotifyParams,
    db: NotificationDbClient = prisma as unknown as NotificationDbClient
) {
    const { topic, title, body, href, channels } = params;

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

    // Tenant resolution: if tenantId omitted, resolve via assignee userId
    let tenantId = params.tenantId;
    const userId = params.userId ?? null;

    if (!tenantId && userId && db.user) {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { tenantId: true },
        });
        tenantId = user?.tenantId ?? undefined;
    }

    if (!tenantId) {
        throw new Error('Cannot send notification: tenantId could not be resolved.');
    }

    // Delivery outcomes: In-app is written first and is always delivered
    const nowIso = new Date().toISOString();
    const channelOutcomes: ChannelOutcomes = {
        in_app: {
            status: 'delivered',
            reason: null,
            at: nowIso,
        },
    };

    const record = await db.notification.create({
        data: {
            tenantId,
            userId, // Assignee only
            type: topic, // type column carries the namespaced topic
            title,
            body,
            entityType,
            entityId,
            href,
            deliveryStatus: 'delivered',
            deliveryReason: null,
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
    tenantId: string;
    userId?: string | null;
    type: NotificationTopic | string;
    title: string;
    body: string;
    entityType: 'quote' | 'invoice' | 'project' | string;
    entityId: string;
    href: string;
}

/**
 * @deprecated Use `notify({ userId, topic, title, body, entity, href })` instead.
 */
export async function createNotification(
    params: CreateNotificationParams,
    db: NotificationDbClient = prisma as unknown as NotificationDbClient
) {
    const topic = (LEGACY_TOPIC_MAP[params.type] || params.type) as NotificationTopic;
    return (
        await notify(
            {
                tenantId: params.tenantId,
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
            db
        )
    ).notification;
}
