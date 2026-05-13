/**
 * GET    /api/tenant/accountant  — get current accountant (if any)
 * POST   /api/tenant/accountant  — invite an accountant
 * DELETE /api/tenant/accountant  — revoke accountant access
 *
 * Any authenticated tenant user can manage their accountant.
 * Accountants do NOT count against seat limits.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { Resend } from 'resend';
import React from 'react';
import InvitationEmail from '@/emails/InvitationEmail';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

// ── GET — get current accountant ──────────────────────────────────────────
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accountant = await prisma.user.findFirst({
            where: { tenantId: user.tenantId, role: 'ACCOUNTANT' },
            select: {
                id: true,
                name: true,
                email: true,
                inviteAccepted: true,
                invitedAt: true,
            },
        });

        return NextResponse.json({ accountant });
    } catch (error: unknown) {
        console.error('[Accountant] GET error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── POST — invite accountant ──────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const session = await auth();
        const inviter = session?.user;
        if (!inviter?.tenantId || !inviter?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { email, name } = body as { email: string; name?: string };

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Check if tenant already has an accountant
        const existingAccountant = await prisma.user.findFirst({
            where: { tenantId: inviter.tenantId, role: 'ACCOUNTANT' },
        });
        if (existingAccountant) {
            return NextResponse.json({
                error: 'An accountant is already configured. Remove the current one first.',
            }, { status: 409 });
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
        }

        // Get tenant branding
        const tenant = await prisma.tenant.findUnique({
            where: { id: inviter.tenantId },
            select: { companyName: true, commercialName: true, logoUrl: true, brandColor: true },
        });

        // Generate invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');

        // Create accountant user
        const accountant = await prisma.user.create({
            data: {
                email,
                name: name || email.split('@')[0],
                role: 'ACCOUNTANT',
                tenantId: inviter.tenantId,
                moduleAccess: {},
                invitedBy: inviter.id,
                invitedAt: new Date(),
                inviteAccepted: false,
                inviteToken,
            },
            select: {
                id: true,
                name: true,
                email: true,
                inviteAccepted: true,
                invitedAt: true,
            },
        });

        // Send branded invite email
        const inviteUrl = `${process.env.NEXTAUTH_URL || 'https://app.coral-group.be'}/accept-invite?token=${inviteToken}`;
        const inviterName = session?.user?.name || 'Your client';
        const brandCompany = tenant?.commercialName || tenant?.companyName || 'CoralOS';

        await resend.emails.send({
            from: `${brandCompany} <noreply@coral-group.be>`,
            to: [email],
            subject: `Accountant access to ${brandCompany} on CoralOS`,
            react: React.createElement(InvitationEmail, {
                inviterName,
                companyName: brandCompany,
                logoUrl: tenant?.logoUrl || undefined,
                brandColor: tenant?.brandColor || '#d35400',
                acceptUrl: inviteUrl,
            }),
        }).catch(err => console.error(`[Accountant Invite] Failed to send to ${email}:`, err));

        console.log(`[Accountant] Invited ${email} to tenant ${inviter.tenantId}`);

        return NextResponse.json({ accountant }, { status: 201 });
    } catch (error: unknown) {
        console.error('[Accountant] POST error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── DELETE — revoke accountant access ─────────────────────────────────────
export async function DELETE() {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accountant = await prisma.user.findFirst({
            where: { tenantId: user.tenantId, role: 'ACCOUNTANT' },
        });

        if (!accountant) {
            return NextResponse.json({ error: 'No accountant found' }, { status: 404 });
        }

        await prisma.user.delete({ where: { id: accountant.id } });

        console.log(`[Accountant] Revoked ${accountant.email} from tenant ${user.tenantId}`);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[Accountant] DELETE error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
