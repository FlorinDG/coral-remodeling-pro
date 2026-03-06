import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchDynamicDatabase, flattenProperties } from "@/lib/notion";

export async function POST(request: Request) {
    try {
        const { connectionId } = await request.json();
        const connection = await prisma.notionConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection) {
            return NextResponse.json({ error: "Connection not found" }, { status: 404 });
        }

        const results = await fetchDynamicDatabase(connection.databaseId, connection.token || undefined);
        const currentNotionIds = (results as any[]).map(page => page.id);

        // 1. Batch upsert entries
        for (const page of results as any[]) {
            const flatData = flattenProperties(page.properties);
            await prisma.notionEntry.upsert({
                where: { notionId: page.id },
                update: {
                    data: flatData,
                    updatedAt: new Date()
                },
                create: {
                    notionId: page.id,
                    connectionId: connection.id,
                    data: flatData
                }
            });
        }

        // 2. Prune local entries that are no longer in Notion
        await prisma.notionEntry.deleteMany({
            where: {
                connectionId: connection.id,
                notionId: { notIn: currentNotionIds }
            }
        });

        await prisma.notionConnection.update({
            where: { id: connectionId },
            data: { lastSynced: new Date() }
        });

        return NextResponse.json({
            success: true,
            count: results.length,
            deleted: "unknown" // prisma.deleteMany doesn't return count in some versions/adapters
        });
    } catch (error: any) {
        console.error("Dynamic sync error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
