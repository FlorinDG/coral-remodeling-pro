import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { hashPassword, validatePassword } from '@/lib/password';
import { WORKSPACE_OWNER_ROLES, platformAccessOf } from '@/lib/roles';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const role = session?.user?.role;
 
        // IMPERSONATE-1: only a platform admin OUTSIDE an impersonation resets across tenants; while impersonating, the
        // reset is confined to the impersonated tenant, like a workspace owner's.
        const access = platformAccessOf(role, (session?.user as { isImpersonating?: boolean } | undefined)?.isImpersonating);
        const isPlatformAdmin = access === 'platform';
        const isWorkspaceOwner = access === 'impersonating' || (role ? WORKSPACE_OWNER_ROLES.includes(role) : false);

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
            const callerTenantId = session?.user?.tenantId;
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
