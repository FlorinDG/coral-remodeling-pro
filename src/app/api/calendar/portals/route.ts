import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const GET = auth(async function GET(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const portals = await prisma.clientPortal.findMany({
            select: {
                id: true,
                clientName: true,
                projectTitle: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(portals);
    } catch (error) {
        console.error("GET /api/calendar/portals Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});
