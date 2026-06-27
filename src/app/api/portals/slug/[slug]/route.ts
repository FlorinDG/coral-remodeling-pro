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

        // 1. Fetch portal tasks from the generic tasks module
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
                fileUrl: props['prop-task-file-url'] || null,
                projectId: props['prop-task-project']?.[0] || null
            };
        });

        // 2. Resolve client's projects dynamically
        const projectsMap = new Map();

        if (portal.linkedProjectId) {
            const globalPage = await prisma.globalPage.findUnique({
                where: { id: portal.linkedProjectId },
                select: { id: true, properties: true }
            });
            if (globalPage) {
                projectsMap.set(globalPage.id, { id: globalPage.id, ...((globalPage.properties as any) || {}) });
            }
        }

        if (portal.clientEmail) {
            // Find clients matching this email
            const clients = await prisma.globalPage.findMany({
                where: {
                    databaseId: 'db-clients',
                    properties: {
                        path: ['email'],
                        equals: portal.clientEmail
                    }
                },
                select: { id: true }
            });

            if (clients.length > 0) {
                const clientIds = clients.map(c => c.id);
                // Prisma JSON filtering doesn't support "in" for array_contains easily, so we use OR
                const projectConditions = clientIds.map(clientId => ({
                    properties: {
                        path: ['prop-client'],
                        array_contains: clientId
                    }
                }));

                const dynamicProjects = await prisma.globalPage.findMany({
                    where: {
                        databaseId: 'db-1',
                        OR: projectConditions
                    },
                    select: { id: true, properties: true }
                });

                for (const p of dynamicProjects) {
                    projectsMap.set(p.id, { id: p.id, ...((p.properties as any) || {}) });
                }
            }
        }

        const projects = Array.from(projectsMap.values());

        // Don't leak the hashed password, just a flag
        const { password, ...safePortal } = portal;
        return NextResponse.json({
            ...safePortal,
            tasks: mappedTasks,
            hasPassword: !!password,
            projects
        });
    } catch (error) {
        console.error("Portal fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}
