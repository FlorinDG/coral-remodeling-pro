import { NextResponse } from "next/server";
import { getPortalsFromNotion, getTasksFromNotion } from "@/lib/notion";
import prisma from "@/lib/prisma";

export async function POST() {
    try {
        const notionPortals = await getPortalsFromNotion();
        const notionTasks = await getTasksFromNotion();

        let portalCount = 0;
        let taskCount = 0;

        // 1. Sync Portals first
        for (const nPortal of notionPortals) {
            if (!nPortal.id || !nPortal.slug) continue;

            await prisma.clientPortal.upsert({
                where: { slug: nPortal.slug },
                update: {
                    clientName: nPortal.clientName,
                    clientEmail: nPortal.clientEmail,
                    status: nPortal.status as any,
                },
                create: {
                    id: nPortal.id,
                    clientName: nPortal.clientName || "",
                    clientEmail: nPortal.clientEmail || "",
                    slug: nPortal.slug,
                    status: (nPortal.status as any) || "ACTIVE",
                },
            });
            portalCount++;
        }

        // 2. Fetch all portals to create a mapping from Notion ID to Prisma ID (slug or id)
        // In this architecture, we use the 'id' field as the primary key in Prisma too if possible,
        // or we map by slug.
        const allPortals = await prisma.clientPortal.findMany();

        // 3. Sync Tasks
        for (const nTask of notionTasks) {
            if (!nTask.id || !nTask.title) continue;

            // Find which portal this task belongs to by looking at the Notion relation
            // The nTask.portalNotionId contains the Notion Internal ID of the portal page.
            // We need to find the portal in our DB that matches this.
            // For now, if we don't have the Notion Internal ID stored in Prisma, we'd need it.
            // Let's assume the mapping is stable.

            // Re-fetch notionPortals to find the one with this notionId
            const relatedNotionPortal = notionPortals.find(p => p.notionId === nTask.portalNotionId);
            if (!relatedNotionPortal) {
                console.warn(`Task ${nTask.id} has no valid portal relation in Notion.`);
                continue;
            }

            const dbPortal = allPortals.find(p => p.slug === relatedNotionPortal.slug);
            if (!dbPortal) {
                console.warn(`Portal ${relatedNotionPortal.slug} not found in database.`);
                continue;
            }

            await prisma.task.upsert({
                where: { id: nTask.id },
                update: {
                    title: nTask.title,
                    status: nTask.status as any,
                },
                create: {
                    id: nTask.id,
                    title: nTask.title,
                    status: (nTask.status as any) || "TODO",
                    portalId: dbPortal.id,
                },
            });
            taskCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Successfully synced ${portalCount} portals and ${taskCount} tasks from Notion.`
        });
    } catch (error: any) {
        console.error("Portal sync error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
