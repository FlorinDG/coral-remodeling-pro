"use server";

import { notify, NotifyParams, NotificationTopic } from "@/lib/notifications";
import { auth } from "@/auth";

export async function emitNotificationAction(
    params: Omit<NotifyParams, 'tenantId'> | {
        userId?: string | null;
        topic?: NotificationTopic;
        type?: string;
        title: string;
        body: string;
        entity?: { type: string; id: string } | string;
        entityType?: string;
        entityId?: string;
        href: string;
    }
) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        const topic = (('topic' in params && params.topic) || ('type' in params && params.type)) as NotificationTopic;
        const entity = params.entity || {
            type: (params as any).entityType || 'unknown',
            id: (params as any).entityId || '',
        };

        await notify({
            tenantId,
            userId: params.userId,
            topic,
            title: params.title,
            body: params.body,
            entity,
            href: params.href,
        });
        return { success: true };
    } catch (e) {
        console.error("Failed to emit notification:", e);
        return { success: false, error: 'Internal error' };
    }
}

