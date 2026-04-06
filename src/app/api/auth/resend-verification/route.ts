import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() }
        });

        if (!user) {
            // Don't reveal whether the email exists
            return NextResponse.json({
                success: true,
                message: 'If an account exists with this email, a verification link has been sent.'
            });
        }

        if (user.emailVerified) {
            return NextResponse.json({
                success: true,
                message: 'This email is already verified. You can sign in.'
            });
        }

        // Generate new verification token
        const verificationToken = randomBytes(32).toString('hex');

        await prisma.user.update({
            where: { id: user.id },
            data: {
                verificationToken,
                verificationSentAt: new Date(),
            }
        });

        // TODO: Send verification email
        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.coral-group.be';
        const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;
        console.log(`[Resend Verification] URL for ${email}: ${verifyUrl}`);

        return NextResponse.json({
            success: true,
            message: 'If an account exists with this email, a verification link has been sent.'
        });

    } catch (error: any) {
        console.error('[Resend Verification Error]', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
