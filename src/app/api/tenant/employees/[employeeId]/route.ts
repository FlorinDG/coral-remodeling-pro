/**
 * PUT    /api/tenant/employees/[employeeId]  — update employee (backed by User table)
 * DELETE /api/tenant/employees/[employeeId]  — delete employee (backed by User table)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES, PLATFORM_ADMIN_ROLES } from '@/lib/roles';

// ── PUT — update employee (User record) ───────────────────────────────
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

        // Verify ownership — user belongs to this tenant
        const existing = await prisma.user.findFirst({
            where: { id: employeeId, tenantId: user.tenantId },
        });
        if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        // Check email uniqueness (excluding self)
        if (email && email !== existing.email) {
            const emailTaken = await prisma.user.findUnique({ where: { email } });
            if (emailTaken) {
                return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
            }
        }

        // Build name from firstName + lastName if provided
        const newName = (firstName !== undefined || lastName !== undefined)
            ? `${firstName ?? existing.name?.split(' ')[0] ?? ''} ${lastName ?? existing.name?.split(' ').slice(1).join(' ') ?? ''}`.trim()
            : undefined;

        const updated = await prisma.user.update({
            where: { id: employeeId },
            data: {
                ...(newName !== undefined && { name: newName }),
                ...(email !== undefined && { email }),
                ...(phone !== undefined && { phone: phone || null }),
                ...(role !== undefined && { role }),
                ...(status !== undefined && { employeeStatus: status }),
                ...(hourlyCost !== undefined && { hourlyCost: hourlyCost ? parseFloat(hourlyCost) : null }),
                ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
            },
        });

        const employee = {
            id: updated.id,
            firstName: updated.name?.split(' ')[0] || '',
            lastName: updated.name?.split(' ').slice(1).join(' ') || '',
            email: updated.email,
            phone: updated.phone,
            role: updated.role,
            status: updated.employeeStatus || 'ACTIVE',
            hourlyCost: updated.hourlyCost,
            hireDate: updated.hireDate,
        };

        return NextResponse.json({ employee });
    } catch (error: unknown) {
        console.error('[Employees] PUT error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// ── DELETE — deactivate employee (soft delete via status) ─────────────
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
        const existing = await prisma.user.findFirst({
            where: { id: employeeId, tenantId: user.tenantId },
        });
        if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        // Soft-delete: set status to INACTIVE instead of hard-deleting the User
        // This preserves shift history, clock entries, etc.
        await prisma.user.update({
            where: { id: employeeId },
            data: { employeeStatus: 'INACTIVE' },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[Employees] DELETE error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
