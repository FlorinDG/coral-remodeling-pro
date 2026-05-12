/**
 * PUT    /api/tenant/employees/[employeeId]  — update employee
 * DELETE /api/tenant/employees/[employeeId]  — delete employee
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES, PLATFORM_ADMIN_ROLES } from '@/lib/roles';

// ── PUT — update employee ─────────────────────────────────────────────
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ employeeId: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!WORKSPACE_OWNER_ROLES.includes(user.role as typeof WORKSPACE_OWNER_ROLES[number])
            && !PLATFORM_ADMIN_ROLES.includes(user.role as typeof PLATFORM_ADMIN_ROLES[number])) {
            return NextResponse.json({ error: 'Only workspace owners can manage employees' }, { status: 403 });
        }

        const { employeeId } = await params;
        const body = await req.json();
        const { firstName, lastName, email, phone, role, status, hourlyCost, hireDate } = body;

        // Verify ownership
        const existing = await prisma.employee.findFirst({
            where: { id: employeeId, tenantId: user.tenantId },
        });
        if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        // Check email uniqueness (excluding self)
        if (email && email !== existing.email) {
            const emailTaken = await prisma.employee.findUnique({ where: { email } });
            if (emailTaken) {
                return NextResponse.json({ error: 'An employee with this email already exists' }, { status: 409 });
            }
        }

        const employee = await prisma.employee.update({
            where: { id: employeeId },
            data: {
                ...(firstName !== undefined && { firstName }),
                ...(lastName !== undefined && { lastName }),
                ...(email !== undefined && { email }),
                ...(phone !== undefined && { phone: phone || null }),
                ...(role !== undefined && { role }),
                ...(status !== undefined && { status }),
                ...(hourlyCost !== undefined && { hourlyCost: hourlyCost ? parseFloat(hourlyCost) : null }),
                ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
            },
        });

        return NextResponse.json({ employee });
    } catch (error: unknown) {
        console.error('[Employees] PUT error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── DELETE — remove employee ──────────────────────────────────────────
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ employeeId: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!WORKSPACE_OWNER_ROLES.includes(user.role as typeof WORKSPACE_OWNER_ROLES[number])
            && !PLATFORM_ADMIN_ROLES.includes(user.role as typeof PLATFORM_ADMIN_ROLES[number])) {
            return NextResponse.json({ error: 'Only workspace owners can manage employees' }, { status: 403 });
        }

        const { employeeId } = await params;

        // Verify ownership
        const existing = await prisma.employee.findFirst({
            where: { id: employeeId, tenantId: user.tenantId },
        });
        if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        await prisma.employee.delete({ where: { id: employeeId } });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[Employees] DELETE error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
