import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchDynamicDatabase, flattenProperties } from "@/lib/notion";

export async function POST() {
    try {
        const connections = await prisma.notionConnection.findMany();
        let totalCount = 0;

        for (const connection of connections) {
            try {
                const results = await fetchDynamicDatabase(connection.databaseId, connection.token || undefined);

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

                await prisma.notionConnection.update({
                    where: { id: connection.id },
                    data: { lastSynced: new Date() }
                });

                totalCount += results.length;
            } catch (e) {
                console.error(`Failed to sync connection ${connection.id}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            totalEntriesSynced: totalCount,
            connectionsSynced: connections.length
        });
    } catch (error: any) {
        console.error("Global sync error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
