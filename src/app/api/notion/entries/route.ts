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

export async function POST(request: Request) {
    try {
        const { connectionId, data } = await request.json();

        const connection = await prisma.notionConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection) {
            return NextResponse.json({ error: "Connection not found" }, { status: 404 });
        }

        const notion = (await import("@/lib/notion"));

        // 1. Create in Notion
        const response = await notion.createDynamicPage(data, connection.databaseId, connection.token || undefined);

        // 2. Create locally with the new Notion ID
        const flatData = notion.flattenProperties((response as any).properties);
        const entry = await prisma.notionEntry.create({
            data: {
                notionId: response.id,
                connectionId: connection.id,
                data: flatData
            }
        });

        return NextResponse.json(entry);
    } catch (error: any) {
        console.error("Create entry error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { entryId } = await request.json();

        const entry = await prisma.notionEntry.findUnique({
            where: { id: entryId },
            include: { connection: true }
        });

        if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

        const notion = (await import("@/lib/notion"));

        // 1. Archive in Notion
        try {
            await notion.deleteDynamicPage(entry.notionId, entry.connection.token || undefined);
        } catch (e: any) {
            console.warn("Failed to delete in Notion, might be already gone:", e.message);
        }

        // 2. Delete locally
        await prisma.notionEntry.delete({
            where: { id: entryId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete entry error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
