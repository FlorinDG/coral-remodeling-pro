"use server";

import { notify, NotifyParams, NotificationTopic } from "@/lib/notifications";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function emitNotificationAction(
    params: NotifyParams | {
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

        await notify(
            {
                userId: params.userId,
                topic,
                title: params.title,
                body: params.body,
                entity,
                href: params.href,
            },
            { tenantId, db: prisma }
        );
        return { success: true };
    } catch (e) {
        console.error("Failed to emit notification:", e);
        return { success: false, error: 'Internal error' };
    }
}

