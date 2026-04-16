import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validatePassword, hashPassword } from '@/lib/password';
import { randomBytes } from 'crypto';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, password, language } = body;

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

        // Use the language selected by the user (fallback to nl)
        const userLanguage = language || 'nl';

        // ── Founding Users Cap (atomic — race-condition safe) ────────────────
        // First 20 tenants = FOUNDER (free, unlimited Peppol).
        // The count + create run inside a serializable transaction so two
        // simultaneous signups can't both slip through at count=19.
        const FOUNDING_CAP = 20;

        const { newTenant, user } = await prisma.$transaction(async (tx) => {
            const tenantCount = await tx.tenant.count();
            if (tenantCount >= FOUNDING_CAP) {
                throw Object.assign(
                    new Error('We zijn momenteel in gesloten bèta. Laat je e-mail achter op coral-group.be om op de wachtlijst te komen.'),
                    { code: 'FOUNDER_CAP_REACHED' }
                );
            }

            const newTenant = await tx.tenant.create({
                data: {
                    companyName: name ? `${name}'s Workspace` : 'New Workspace',
                    planType: 'FOUNDER',
                    subscriptionStatus: 'ACTIVE',
                    activeModules: ['INVOICING'],
                    documentLanguage: userLanguage,
                },
            });

            const user = await tx.user.create({
                data: {
                    name: name.trim(),
                    email: email.toLowerCase().trim(),
                    password: hashedPassword,
                    role: 'TENANT_ADMIN',
                    tenantId: newTenant.id,
                    environmentLanguage: userLanguage,
                    verificationToken,
                    verificationSentAt: new Date(),
                },
            });

            return { newTenant, user };
        });

        // Send verification email
        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.coral-group.be';
        const verifyUrl = `${baseUrl}/api/auth/verify?token=${verificationToken}`;
        await sendVerificationEmail({
            to: email.toLowerCase().trim(),
            name: name.trim(),
            verificationUrl: verifyUrl,
        });

        return NextResponse.json({
            success: true,
            message: 'Account created successfully. Please check your email to verify your account.',
        });

    } catch (error: any) {
        if (error?.code === 'FOUNDER_CAP_REACHED') {
            return NextResponse.json(
                { error: error.message },
                { status: 403 }
            );
        }
        console.error('[Signup Error]', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
