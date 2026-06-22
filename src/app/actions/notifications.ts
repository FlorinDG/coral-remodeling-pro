"use server";

import { createNotification, CreateNotificationParams } from "@/lib/notifications";
import { auth } from "@/auth";

export async function emitNotificationAction(params: Omit<CreateNotificationParams, 'tenantId'>) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        await createNotification({
            ...params,
            tenantId
        });
        return { success: true };
    } catch (e) {
        console.error("Failed to emit notification:", e);
        return { success: false, error: 'Internal error' };
    }
}
