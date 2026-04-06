import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validatePassword, hashPassword } from '@/lib/password';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, password } = body;

        // Validate required fields
        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Name, email, and password are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate password requirements
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: 'Password does not meet requirements', details: passwordValidation.errors },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() }
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Generate verification token
        const verificationToken = randomBytes(32).toString('hex');

        // Detect locale from cookie
        const cookieStore = await cookies();
        const nextLocale = cookieStore.get('NEXT_LOCALE')?.value || 'fr';

        // Auto-provision tenant workspace (same logic as Google OAuth in auth.ts)
        const newTenant = await prisma.tenant.create({
            data: {
                companyName: name ? `${name}'s Workspace` : 'New Workspace',
                planType: "FREE",
                subscriptionStatus: "ACTIVE",
                activeModules: ["INVOICING"],
                documentLanguage: nextLocale
            }
        });

        // Create the user
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                role: "TENANT_ADMIN",
                tenantId: newTenant.id,
                environmentLanguage: nextLocale,
                verificationToken,
                verificationSentAt: new Date(),
            }
        });

        // TODO: Send verification email
        // For now, log the verification URL for development
        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.coral-group.be';
        const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;
        console.log(`[Signup] Verification URL for ${email}: ${verifyUrl}`);

        return NextResponse.json({
            success: true,
            message: 'Account created successfully. Please check your email to verify your account.',
        });

    } catch (error: any) {
        console.error('[Signup Error]', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
