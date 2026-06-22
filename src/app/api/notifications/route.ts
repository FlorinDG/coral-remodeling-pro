import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const userId = (session.user as any).id;
    if (!tenantId || !userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const cursor = searchParams.get('cursor');

    const limit = 20;

    const where: any = {
        tenantId,
        OR: [
            { userId: userId },
            { userId: null }
        ]
    };

    if (status === 'unread') {
        where.readAt = null;
    }

    const items = await prisma.notification.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' }
    });

    let nextCursor = null;
    if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
    }

    let unreadCount = 0;
    if (status === 'unread') {
        unreadCount = items.length; // Approximate if over limit, but let's do a real count
        unreadCount = await prisma.notification.count({
            where: {
                ...where,
                readAt: null
            }
        });
    } else {
        unreadCount = await prisma.notification.count({
            where: {
                ...where,
                readAt: null
            }
        });
    }

    return NextResponse.json({
        items,
        unreadCount,
        nextCursor
    });
}
