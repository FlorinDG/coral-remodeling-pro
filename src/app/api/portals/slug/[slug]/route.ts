import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, context: any) {
    const { params } = context;
    const { slug } = await params;

    try {
        const portal = await prisma.clientPortal.findUnique({
            where: { slug },
            include: {
                updates: { orderBy: { createdAt: 'desc' } },
                tasks: { orderBy: { createdAt: 'asc' } },
                documents: { orderBy: { createdAt: 'desc' } },
                media: { orderBy: { createdAt: 'desc' } },
                messages: { orderBy: { createdAt: 'asc' } }
            }
        });

        if (!portal) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Don't leak the hashed password, just a flag
        const { password, ...safePortal } = portal;
        return NextResponse.json({
            ...safePortal,
            hasPassword: !!password
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}
