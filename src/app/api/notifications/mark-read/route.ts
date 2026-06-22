import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const userId = (session.user as any).id;
    if (!tenantId || !userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { ids, entityId, all } = body;

    const where: any = {
        tenantId,
        OR: [
            { userId: userId },
            { userId: null }
        ],
        readAt: null
    };

    if (all) {
        // mark all read for this user
    } else if (entityId) {
        where.entityId = entityId;
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
        where.id = { in: ids };
    } else {
        return new NextResponse("Bad Request", { status: 400 });
    }

    await prisma.notification.updateMany({
        where,
        data: {
            readAt: new Date()
        }
    });

    return NextResponse.json({ success: true });
}
