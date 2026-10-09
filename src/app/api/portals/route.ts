import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";
import { auth } from '@/auth';
import { scopeFromSession, type TenantScopedClient } from '@/lib/data/scope';
import { systemDatabaseId } from '@/lib/data/system-databases';
import { saveRecord } from '@/lib/data/records';
import { buildPortalProjectCreateData } from '@/lib/records/portal-export-intents';

/** A page in THIS tenant's projects database (the scoped client cannot see another tenant's). */
async function isOwnProject(db: TenantScopedClient, id: string): Promise<boolean> {
    return !!(await db.globalPage.findFirst({ where: { id, database: { logicalKey: 'projects' } }, select: { id: true } }));
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { clientName, clientEmail, projectTitle, serviceId, budget, paidAmount, password, createProject, linkedProjectId: providedLinkedProjectId, audience } = body;

        // Seraph (R2-1-CENSUS #25, 2026-10-04): the session scope for every read/write; the projects database
        // from the binding (no 'db-1' fallback); a linked project must be a project of THIS tenant.
        const db = await scopeFromSession();
        let finalLinkedProjectId = providedLinkedProjectId || null;
        if (finalLinkedProjectId && !(await isOwnProject(db, finalLinkedProjectId))) {
            return NextResponse.json({ error: 'linkedProjectId is not a project of this workspace' }, { status: 400 });
        }
        let projectDbId: string | null = null;
        try { projectDbId = await systemDatabaseId(tenantId, 'projects'); } catch { /* no projects database: a portal without a project */ }

        if (createProject && projectTitle && !finalLinkedProjectId) {
            if (!projectDbId) return NextResponse.json({ error: 'unbound_system_database: projects' }, { status: 409 });
            const pageId = crypto.randomUUID();
            const { intent, opts } = buildPortalProjectCreateData({
                pageId,
                databaseId: projectDbId,
                projectTitle,
                clientName,
                budget,
                userId: session?.user?.id,
            });
            const res = await saveRecord(db, intent, opts);
            if (!res.ok) {
                return NextResponse.json({ error: `Failed to create project: ${res.refusal.code}` }, { status: 500 });
            }
            finalLinkedProjectId = pageId;
        }

        const slug = nanoid(10);
        let hashedPassword = null;
        if (password) {
            const bcrypt = await import('bcryptjs');
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const portal = await db.clientPortal.create({
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
                linkedDatabaseId: projectDbId,
                audience: audience || 'CUSTOMER'
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
        const { id, budget, paidAmount, status, password, audience } = body;

        // Verify portal belongs to caller's tenant
        const existing = await prisma.clientPortal.findFirst({ where: { id, tenantId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updatedData: any = { budget, paidAmount, status };
        if (body.linkedProjectId !== undefined) {
            // Only a project of THIS tenant may be linked; the database is the binding, never the body's.
            const db = await scopeFromSession();
            if (body.linkedProjectId && !(await isOwnProject(db, body.linkedProjectId))) {
                return NextResponse.json({ error: 'linkedProjectId is not a project of this workspace' }, { status: 400 });
            }
            updatedData.linkedProjectId = body.linkedProjectId || null;
            try { updatedData.linkedDatabaseId = body.linkedProjectId ? await systemDatabaseId(tenantId, 'projects') : null; } catch { updatedData.linkedDatabaseId = null; }
        }
        if (audience !== undefined) updatedData.audience = audience;

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
