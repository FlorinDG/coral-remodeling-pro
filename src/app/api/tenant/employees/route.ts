/**
 * GET  /api/tenant/employees     — list employees for the tenant
 * POST /api/tenant/employees     — create a new employee
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES, PLATFORM_ADMIN_ROLES } from '@/lib/roles';

// ── GET — list employees ──────────────────────────────────────────────
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as unknown as { tenantId?: string };
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const employees = await prisma.employee.findMany({
            where: { tenantId: user.tenantId },
            orderBy: { lastName: 'asc' },
        });

        return NextResponse.json({ employees });
    } catch (error: unknown) {
        console.error('[Employees] GET error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── POST — create employee ────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = session?.user as unknown as { tenantId?: string; role?: string };
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Only workspace owners/managers or platform admins can create employees
        const userRole = user.role as string;
        const canManageEmployees = WORKSPACE_OWNER_ROLES.includes(userRole as typeof WORKSPACE_OWNER_ROLES[number])
            || PLATFORM_ADMIN_ROLES.includes(userRole as typeof PLATFORM_ADMIN_ROLES[number]);
        if (!canManageEmployees) {
            return NextResponse.json({ error: 'Only workspace owners can manage employees' }, { status: 403 });
        }

        const body = await req.json();
        const { firstName, lastName, email, phone, role, status, hourlyCost, hireDate } = body;

        if (!firstName || !lastName || !email || !role) {
            return NextResponse.json({ error: 'First name, last name, email, and role are required' }, { status: 400 });
        }

        // Check unique email
        const existing = await prisma.employee.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'An employee with this email already exists' }, { status: 409 });
        }

        const employee = await prisma.employee.create({
            data: {
                tenantId: user.tenantId,
                firstName,
                lastName,
                email,
                phone: phone || null,
                role,
                status: status || 'ACTIVE',
                hourlyCost: hourlyCost ? parseFloat(hourlyCost) : null,
                hireDate: hireDate ? new Date(hireDate) : null,
            },
        });

        return NextResponse.json({ employee }, { status: 201 });
    } catch (error: unknown) {
        console.error('[Employees] POST error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
