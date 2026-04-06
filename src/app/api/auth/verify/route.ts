import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get('token');

        if (!token) {
            return NextResponse.redirect(new URL('/login?error=missing_token', req.url));
        }

        // Find user by verification token
        const user = await prisma.user.findFirst({
            where: { verificationToken: token }
        });

        if (!user) {
            return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
        }

        if (user.emailVerified) {
            return NextResponse.redirect(new URL('/login?verified=already', req.url));
        }

        // Verify the user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: new Date(),
                verificationToken: null,
            }
        });

        // Redirect to login with success message
        return NextResponse.redirect(new URL('/login?verified=success', req.url));

    } catch (error: any) {
        console.error('[Verify Error]', error);
        return NextResponse.redirect(new URL('/login?error=verification_failed', req.url));
    }
}
