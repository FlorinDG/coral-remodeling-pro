/**
 * GET  /api/tenant/users        — list workspace users
 * POST /api/tenant/users        — invite a new user
 *
 * Only WORKSPACE_OWNER_ROLES can access these endpoints.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES, PLAN_USER_LIMITS } from '@/lib/roles';
import crypto from 'crypto';

// ── GET — list workspace users ────────────────────────────────────────────
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as unknown as { tenantId?: string; role?: string };
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const users = await prisma.user.findMany({
            where: { tenantId: user.tenantId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                moduleAccess: true,
                inviteAccepted: true,
                invitedAt: true,
                emailVerified: true,
                image: true,
            },
            orderBy: { invitedAt: 'desc' },
        });

        // Get plan limits
        const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { planType: true },
        });
        const maxUsers = PLAN_USER_LIMITS[tenant?.planType ?? 'FREE'] ?? 1;

        return NextResponse.json({ users, maxUsers, currentCount: users.length });
    } catch (error: unknown) {
        console.error('[Tenant Users] GET error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── POST — invite a new user ──────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const session = await auth();
        const inviter = session?.user as unknown as { id?: string; tenantId?: string; role?: string };
        if (!inviter?.tenantId || !inviter?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only workspace owners can invite
        if (!WORKSPACE_OWNER_ROLES.includes(inviter.role as typeof WORKSPACE_OWNER_ROLES[number])) {
            return NextResponse.json({ error: 'Only workspace owners can invite users' }, { status: 403 });
        }

        const body = await req.json();
        const { email, name, role, moduleAccess } = body as {
            email: string;
            name?: string;
            role: string;
            moduleAccess?: Record<string, string>;
        };

        if (!email || !role) {
            return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
        }

        // Check seat limits
        const tenant = await prisma.tenant.findUnique({
            where: { id: inviter.tenantId },
            select: { planType: true },
        });
        const maxUsers = PLAN_USER_LIMITS[tenant?.planType ?? 'FREE'] ?? 1;
        const currentCount = await prisma.user.count({ where: { tenantId: inviter.tenantId } });

        if (currentCount >= maxUsers) {
            return NextResponse.json({
                error: 'SEAT_LIMIT_REACHED',
                message: `Your ${tenant?.planType} plan allows ${maxUsers} users. Upgrade to add more.`,
                maxUsers,
                currentCount,
            }, { status: 403 });
        }

        // Generate invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');

        // Create user record (pending invite)
        const newUser = await prisma.user.create({
            data: {
                email,
                name: name || email.split('@')[0],
                role,
                tenantId: inviter.tenantId,
                moduleAccess: moduleAccess || {},
                invitedBy: inviter.id,
                invitedAt: new Date(),
                inviteAccepted: false,
                inviteToken,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                moduleAccess: true,
                inviteAccepted: true,
                invitedAt: true,
            },
        });

        // TODO: Send invite email with tenant branding
        // For now, return the token so the admin can share the link
        const inviteUrl = `${process.env.NEXTAUTH_URL || 'https://app.coral-group.be'}/accept-invite?token=${inviteToken}`;

        console.log(`[Tenant Users] Invited ${email} as ${role} to tenant ${inviter.tenantId}`);

        return NextResponse.json({ user: newUser, inviteUrl }, { status: 201 });
    } catch (error: unknown) {
        console.error('[Tenant Users] POST error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
