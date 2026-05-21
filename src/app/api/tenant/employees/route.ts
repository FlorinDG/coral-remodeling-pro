/**
 * GET  /api/tenant/employees     — list employees for the tenant (backed by User table)
 * POST /api/tenant/employees     — create a new employee as a User record
 * 
 * NOTE: This is a legacy compatibility endpoint. The canonical path is /api/hr/employees.
 * Both endpoints now query the User table — Employee records are no longer created.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES, PLATFORM_ADMIN_ROLES } from '@/lib/roles';

// Roles that count as "employees" in HR context
const HR_EMPLOYEE_ROLES = [
    'TENANT_PRO_EMPLOYEE',
    'TENANT_ENTERPRISE_EMPLOYEE',
    'TENANT_ENTERPRISE_WORKFORCE',
    'TENANT_ENTERPRISE_MANAGER',
    'BOOKKEEPING',
    'TEAMLEAD',
    'PROJECT_MANAGER',
    'HR_OFFICER',
    'OFFERTES',
];

// ── GET — list employees (backed by User table) ──────────────────────
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const users = await prisma.user.findMany({
            where: {
                tenantId: user.tenantId,
                role: { in: HR_EMPLOYEE_ROLES },
            },
            select: {
                id: true, name: true, email: true, phone: true,
                role: true, hourlyCost: true, hireDate: true,
                employeeStatus: true, image: true,
            },
            orderBy: { name: 'asc' },
        });

        // Return in legacy Employee shape
        const employees = users.map(u => ({
            id: u.id,
            firstName: u.name?.split(' ')[0] || '',
            lastName: u.name?.split(' ').slice(1).join(' ') || '',
            email: u.email,
            phone: u.phone,
            role: u.role,
            status: u.employeeStatus || 'ACTIVE',
            hourlyCost: u.hourlyCost,
            hireDate: u.hireDate,
        }));

        return NextResponse.json({ employees });
    } catch (error: unknown) {
        console.error('[Employees] GET error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── POST — create employee as User record ────────────────────────────
export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Only workspace owners/managers or platform admins can create employees
        const userRole = user.role as string;
        const canManageEmployees = WORKSPACE_OWNER_ROLES.includes(userRole as typeof WORKSPACE_OWNER_ROLES[number])
            || PLATFORM_ADMIN_ROLES.includes(userRole as typeof PLATFORM_ADMIN_ROLES[number]);
        if (!canManageEmployees) {
            return NextResponse.json({ error: 'Only workspace owners can manage employees' }, { status: 403 });
        }

        const body = await req.json();
        const { firstName, lastName, email, phone, role, hourlyCost, hireDate } = body;

        if (!firstName || !lastName || !email) {
            return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
        }

        // Check unique email
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
        }

        const newUser = await prisma.user.create({
            data: {
                tenantId: user.tenantId,
                name: `${firstName} ${lastName}`.trim(),
                email,
                phone: phone || null,
                role: role || 'TENANT_ENTERPRISE_WORKFORCE',
                hourlyCost: hourlyCost ? parseFloat(hourlyCost) : null,
                hireDate: hireDate ? new Date(hireDate) : null,
                employeeStatus: 'ACTIVE',
                invitedBy: user.id,
                invitedAt: new Date(),
                inviteAccepted: false,
            },
        });

        const employee = {
            id: newUser.id,
            firstName: newUser.name?.split(' ')[0] || '',
            lastName: newUser.name?.split(' ').slice(1).join(' ') || '',
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            status: newUser.employeeStatus || 'ACTIVE',
            hourlyCost: newUser.hourlyCost,
            hireDate: newUser.hireDate,
        };

        return NextResponse.json({ employee }, { status: 201 });
    } catch (error: unknown) {
        console.error('[Employees] POST error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
