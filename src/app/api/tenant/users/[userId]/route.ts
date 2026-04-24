/**
 * PATCH  /api/tenant/users/[userId]  — update role or moduleAccess
 * DELETE /api/tenant/users/[userId]  — remove user from workspace
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES } from '@/lib/roles';

interface RouteParams {
    params: Promise<{ userId: string }>;
}

// ── PATCH — update user role / access ─────────────────────────────────────
export async function PATCH(req: Request, { params }: RouteParams) {
    try {
        const { userId } = await params;
        const session = await auth();
        const admin = session?.user as unknown as { id?: string; tenantId?: string; role?: string };
        if (!admin?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!WORKSPACE_OWNER_ROLES.includes(admin.role as typeof WORKSPACE_OWNER_ROLES[number])) {
            return NextResponse.json({ error: 'Only workspace owners can manage users' }, { status: 403 });
        }

        // Verify target user belongs to same tenant
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.tenantId !== admin.tenantId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prevent self-demotion
        if (userId === admin.id) {
            return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 });
        }

        const body = await req.json();
        const { role, moduleAccess, name } = body as {
            role?: string;
            moduleAccess?: Record<string, string>;
            name?: string;
        };

        const updateData: Record<string, unknown> = {};
        if (role !== undefined) updateData.role = role;
        if (moduleAccess !== undefined) updateData.moduleAccess = moduleAccess;
        if (name !== undefined) updateData.name = name;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true, name: true, email: true, role: true,
                moduleAccess: true, inviteAccepted: true,
            },
        });

        console.log(`[Tenant Users] Updated user ${userId}: ${JSON.stringify(updateData)}`);
        return NextResponse.json({ user: updated });
    } catch (error: unknown) {
        console.error('[Tenant Users] PATCH error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── DELETE — remove user from workspace ───────────────────────────────────
export async function DELETE(_req: Request, { params }: RouteParams) {
    try {
        const { userId } = await params;
        const session = await auth();
        const admin = session?.user as unknown as { id?: string; tenantId?: string; role?: string };
        if (!admin?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!WORKSPACE_OWNER_ROLES.includes(admin.role as typeof WORKSPACE_OWNER_ROLES[number])) {
            return NextResponse.json({ error: 'Only workspace owners can remove users' }, { status: 403 });
        }

        // Prevent self-deletion
        if (userId === admin.id) {
            return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
        }

        // Verify target user belongs to same tenant
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.tenantId !== admin.tenantId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await prisma.user.delete({ where: { id: userId } });

        console.log(`[Tenant Users] Removed user ${userId} from tenant ${admin.tenantId}`);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[Tenant Users] DELETE error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
