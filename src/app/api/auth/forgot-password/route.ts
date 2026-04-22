import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

        const normalizedEmail = email.toLowerCase().trim();

        // Always return 200 to prevent email enumeration
        const successResponse = NextResponse.json({ ok: true });

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // No user, or Google-only user (no password) → silent success
        if (!user || !user.password) return successResponse;

        // Generate a random token (raw) and store a hashed version
        const rawToken = crypto.randomUUID();
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // 1-hour expiry
        const expires = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: expires,
            },
        });

        // Build the reset URL
        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.coral-group.be';
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

        await sendPasswordResetEmail({
            to: normalizedEmail,
            name: user.name || 'User',
            resetUrl,
        });

        return successResponse;
    } catch (error) {
        console.error('[forgot-password] Error:', error);
        // Still return 200 to prevent info leaking
        return NextResponse.json({ ok: true });
    }
}
