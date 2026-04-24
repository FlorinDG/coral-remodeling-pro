/**
 * POST /api/auth/accept-invite
 *
 * Accepts a workspace invite. Sets password, marks invite as accepted.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { token, password, name } = body as {
            token: string;
            password: string;
            name?: string;
        };

        if (!token || !password) {
            return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        // Find user by invite token
        const user = await prisma.user.findUnique({ where: { inviteToken: token } });
        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 404 });
        }

        if (user.inviteAccepted) {
            return NextResponse.json({ error: 'Invite already accepted' }, { status: 409 });
        }

        // Hash password and activate
        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                name: name || user.name,
                inviteAccepted: true,
                inviteToken: null, // invalidate token
                emailVerified: new Date(),
            },
        });

        console.log(`[Accept Invite] User ${user.email} accepted invite for tenant ${user.tenantId}`);

        return NextResponse.json({
            success: true,
            message: 'Invite accepted. You can now log in.',
            email: user.email,
        });
    } catch (error: unknown) {
        console.error('[Accept Invite] Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
