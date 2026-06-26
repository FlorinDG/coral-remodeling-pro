"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function getHrAnnouncements() {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
        throw new Error("No tenant context");
    }

    const announcements = await prisma.hrAnnouncement.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    const readRecords = await prisma.hrAnnouncementRead.findMany({
        where: {
            userId: session.user.id,
            announcementId: { in: announcements.map(a => a.id) }
        }
    });

    const readIds = new Set(readRecords.map(r => r.announcementId));

    const userIds = Array.from(new Set(announcements.map(a => a.createdBy)));
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
    });
    
    const userMap = new Map(users.map(u => [u.id, u.name]));

    return announcements.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority as 'normal' | 'important' | 'urgent',
        created_at: a.createdAt.toISOString(),
        created_by: a.createdBy,
        author_name: userMap.get(a.createdBy) || 'Admin',
        is_read: readIds.has(a.id)
    }));
}

export async function markHrAnnouncementRead(announcementId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    await prisma.hrAnnouncementRead.upsert({
        where: {
            userId_announcementId: {
                userId: session.user.id,
                announcementId
            }
        },
        update: {
            readAt: new Date()
        },
        create: {
            userId: session.user.id,
            announcementId,
            readAt: new Date()
        }
    });
    
    return { success: true };
}
