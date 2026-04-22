import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { hashPassword, validatePassword } from '@/lib/password';
import { PLATFORM_ADMIN_ROLES } from '@/lib/roles';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const role = (session?.user as any)?.role;

        if (!PLATFORM_ADMIN_ROLES.includes(role)) {
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

        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
