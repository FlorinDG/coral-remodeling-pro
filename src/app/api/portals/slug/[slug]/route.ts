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
                documents: { orderBy: { createdAt: 'desc' } },
                media: { orderBy: { createdAt: 'desc' } },
                messages: { orderBy: { createdAt: 'asc' } }
            }
        });

        if (!portal) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Fetch portal tasks from the generic tasks module
        const rawTasks = await prisma.globalPage.findMany({
            where: {
                databaseId: 'db-tasks',
                properties: {
                    path: ['prop-task-portal'],
                    array_contains: portal.id
                }
            }
        });

        const mappedTasks = rawTasks.map(p => {
            const props = (p.properties as any) || {};
            return {
                id: p.id,
                title: props['title'] || 'Untitled',
                status: props['prop-task-status'] === 'opt-done' ? 'DONE' : 'TODO',
                dueDate: props['prop-task-due'] || null,
                fileUrl: props['prop-task-file-url'] || null
            };
        });

        let linkedProjectData = null;
        if (portal.linkedProjectId) {
            const globalPage = await prisma.globalPage.findUnique({
                where: { id: portal.linkedProjectId },
                select: { properties: true } // only exposing safe properties to client
            });
            if (globalPage) {
                linkedProjectData = globalPage.properties;
            }
        }

        // Don't leak the hashed password, just a flag
        const { password, ...safePortal } = portal;
        return NextResponse.json({
            ...safePortal,
            tasks: mappedTasks,
            hasPassword: !!password,
            linkedProjectData
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}
