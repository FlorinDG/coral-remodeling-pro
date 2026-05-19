/**
 * GET  /api/tenant/project-access?userId=X  — get project IDs assigned to user
 * PUT  /api/tenant/project-access            — replace project assignments for a user
 *      body: { userId: string, projectIds: string[] }
 *
 * Only WORKSPACE_OWNER_ROLES can PUT (assign projects).
 * Any ERP user can GET (read their own or another user's assignments).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES } from '@/lib/roles';

// ── GET — fetch project IDs assigned to a user ───────────────────────────
export async function GET(req: Request) {
    try {
        const session = await auth();
        const caller = session?.user;
        if (!caller?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

        const rows = await prisma.userProjectAccess.findMany({
            where: { tenantId: caller.tenantId, userId },
            select: { projectId: true },
        });

        return NextResponse.json({ projectIds: rows.map((r: { projectId: string }) => r.projectId) });
    } catch (error: unknown) {
        console.error('[ProjectAccess] GET error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── PUT — replace all project assignments for a user ─────────────────────
export async function PUT(req: Request) {
    try {
        const session = await auth();
        const caller = session?.user;
        if (!caller?.tenantId || !caller?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only workspace owners can assign projects
        if (!WORKSPACE_OWNER_ROLES.includes(caller.role as typeof WORKSPACE_OWNER_ROLES[number])) {
            return NextResponse.json({ error: 'Only workspace owners can assign project access' }, { status: 403 });
        }

        const body = await req.json() as { userId: string; projectIds: string[] };
        const { userId, projectIds } = body;

        if (!userId || !Array.isArray(projectIds)) {
            return NextResponse.json({ error: 'userId and projectIds[] are required' }, { status: 400 });
        }

        // Verify the target user belongs to this tenant
        const target = await prisma.user.findFirst({
            where: { id: userId, tenantId: caller.tenantId },
            select: { id: true },
        });
        if (!target) return NextResponse.json({ error: 'User not found in workspace' }, { status: 404 });

        // Atomic replace: delete existing rows, insert new ones
        await prisma.$transaction([
            prisma.userProjectAccess.deleteMany({
                where: { tenantId: caller.tenantId, userId },
            }),
            ...(projectIds.length > 0
                ? [prisma.userProjectAccess.createMany({
                    data: projectIds.map(pid => ({
                        tenantId: caller.tenantId!,
                        userId,
                        projectId: pid,
                    })),
                    skipDuplicates: true,
                  })]
                : []),
        ]);

        console.log(`[ProjectAccess] Updated: ${projectIds.length} projects assigned to user ${userId}`);
        return NextResponse.json({ ok: true, userId, projectIds });
    } catch (error: unknown) {
        console.error('[ProjectAccess] PUT error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
