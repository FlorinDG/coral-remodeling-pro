import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientName, clientEmail } = body;

        const slug = nanoid(10); // Simple 10-char slug

        const portal = await prisma.clientPortal.create({
            data: {
                clientName,
                clientEmail,
                slug,
            },
        });

        return NextResponse.json(portal, { status: 201 });
    } catch (error) {
        console.error("Error creating portal:", error);
        return NextResponse.json(
            { error: "Failed to create client portal" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const portals = await prisma.clientPortal.findMany({
            include: { updates: true },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(portals);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch portals" },
            { status: 500 }
        );
    }
}
