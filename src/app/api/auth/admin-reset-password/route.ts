import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { hashPassword, validatePassword } from '@/lib/password';
import { PLATFORM_ADMIN_ROLES, WORKSPACE_OWNER_ROLES } from '@/lib/roles';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const caller = session?.user as any;
        const role = caller?.role;

        const isPlatformAdmin = PLATFORM_ADMIN_ROLES.includes(role);
        const isWorkspaceOwner = WORKSPACE_OWNER_ROLES.includes(role);

        if (!isPlatformAdmin && !isWorkspaceOwner) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { userId, newPassword } = await req.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate password strength
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
        }

        // Verify target user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Workspace owners can only reset passwords for users in their own tenant
        if (!isPlatformAdmin && isWorkspaceOwner) {
            const callerTenantId = caller?.tenantId;
            if (!callerTenantId || user.tenantId !== callerTenantId) {
                return NextResponse.json({ error: 'You can only reset passwords for your own team members' }, { status: 403 });
            }
        }

        // Hash and save
        const hashedPassword = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[admin-reset-password] Error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
