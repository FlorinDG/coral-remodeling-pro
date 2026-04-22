import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { hashPassword, validatePassword } from '@/lib/password';

export async function POST(req: Request) {
    try {
        const { email, token, newPassword } = await req.json();

        if (!email || !token || !newPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate password strength
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        // Verify token matches
        if (user.passwordResetToken !== hashedToken) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        // Verify not expired
        if (new Date() > user.passwordResetExpires) {
            // Clear expired token
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordResetToken: null, passwordResetExpires: null },
            });
            return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
        }

        // Hash new password and clear reset token
        const hashedPassword = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[reset-password] Error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
