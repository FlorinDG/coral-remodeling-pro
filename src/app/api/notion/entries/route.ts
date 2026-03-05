import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("connectionId");

    if (!connectionId) {
        return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
    }

    try {
        const entries = await prisma.notionEntry.findMany({
            where: { connectionId },
            orderBy: { updatedAt: "desc" }
        });
        return NextResponse.json(entries);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
    }
}
