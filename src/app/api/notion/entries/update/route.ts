import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { updateDynamicPage } from "@/lib/notion";

// Triggering re-scan for Prisma types
export async function PATCH(request: Request) {
    try {
        const { entryId, data } = await request.json();

        const entry = await (prisma as any).notionEntry.findUnique({
            where: { id: entryId },
            include: { connection: true }
        });

        if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

        // Push to Notion
        await updateDynamicPage(
            entry.notionId,
            data,
            entry.connection.databaseId,
            entry.connection.token || undefined
        );

        // Update locally
        const updated = await (prisma as any).notionEntry.update({
            where: { id: entryId },
            data: { data: { ...(entry.data as object), ...data } }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Update sync error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
