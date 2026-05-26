import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { clientName, clientEmail, projectTitle, serviceId, budget, paidAmount, password, createProject, linkedProjectId: providedLinkedProjectId } = body;

        let finalLinkedProjectId = providedLinkedProjectId || null;
        const finalLinkedDatabaseId = 'db-1';

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { lockedDbIds: true } });
        const locked = (tenant?.lockedDbIds as Record<string, string>) || {};
        const projectDbId = locked['projects'] || 'db-1';

        if (createProject && projectTitle && !finalLinkedProjectId) {
            const globalPage = await prisma.globalPage.create({
                data: {
                    databaseId: projectDbId,
                    properties: { title: projectTitle, clientName, status: 'New', budget: budget || 0 },
                    createdBy: session?.user?.id || 'system',
                    lastEditedBy: session?.user?.id || 'system',
                    assignedTo: []
                }
            });
            finalLinkedProjectId = globalPage.id;
        }

        const slug = nanoid(10);
        let hashedPassword = null;
        if (password) {
            const bcrypt = await import('bcryptjs');
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const portal = await prisma.clientPortal.create({
            data: {
                tenantId,
                clientName,
                clientEmail,
                projectTitle,
                serviceId,
                slug,
                budget: budget || 0,
                paidAmount: paidAmount || 0,
                password: hashedPassword,
                linkedProjectId: finalLinkedProjectId,
                linkedDatabaseId: projectDbId
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

export async function PATCH(request: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, budget, paidAmount, status, password } = body;

        // Verify portal belongs to caller's tenant
        const existing = await prisma.clientPortal.findFirst({ where: { id, tenantId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updatedData: any = { budget, paidAmount, status };
        if (body.linkedProjectId !== undefined) updatedData.linkedProjectId = body.linkedProjectId;
        if (body.linkedDatabaseId !== undefined) updatedData.linkedDatabaseId = body.linkedDatabaseId;

        if (password) {
            const bcrypt = await import('bcryptjs');
            updatedData.password = await bcrypt.hash(password, 10);
        }

        const portal = await prisma.clientPortal.update({
            where: { id },
            data: updatedData
        });

        return NextResponse.json(portal);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update portal" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const portals = await prisma.clientPortal.findMany({
            where: { tenantId },
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
