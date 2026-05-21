/**
 * POST /api/hr/link-employees — One-time migration: link Employee records to User records
 * 
 * For each Employee in the tenant:
 * - If a User with the same email exists → copy HR fields to User + remap shift references
 * - If no User exists → create a new User with TENANT_ENTERPRISE_WORKFORCE role
 * 
 * Also remaps all ScheduledShift.userId, ClockEntry.userId, HrTeamMember.userId,
 * and TimeOffRequest.userId from old Employee.id → new User.id.
 * 
 * Admin-only endpoint. Safe to run multiple times (idempotent).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES, PLATFORM_ADMIN_ROLES } from '@/lib/roles';

export async function POST() {
    try {
        const session = await auth();
        const user = session?.user;
        if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Only admins can run migration
        const userRole = user.role as string;
        const isAdmin = WORKSPACE_OWNER_ROLES.includes(userRole as typeof WORKSPACE_OWNER_ROLES[number])
            || PLATFORM_ADMIN_ROLES.includes(userRole as typeof PLATFORM_ADMIN_ROLES[number]);
        if (!isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const tenantId = user.tenantId;

        // Fetch all Employee records for this tenant
        const employees = await prisma.employee.findMany({
            where: { tenantId },
        });

        const results = {
            linked: 0,
            created: 0,
            skipped: 0,
            shiftsRemapped: 0,
            clockEntriesRemapped: 0,
            teamMembersRemapped: 0,
            timeOffRemapped: 0,
            errors: [] as string[],
        };

        // Map old Employee.id → new User.id for remapping
        const idMap = new Map<string, string>();

        for (const emp of employees) {
            try {
                if (!emp.email) {
                    results.skipped++;
                    continue;
                }

                // Check if a User already exists with this email
                const existingUser = await prisma.user.findUnique({
                    where: { email: emp.email },
                });

                if (existingUser) {
                    // Link: copy HR fields from Employee → User
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            phone: existingUser.phone || emp.phone || null,
                            hourlyCost: existingUser.hourlyCost ?? emp.hourlyCost ?? null,
                            hireDate: existingUser.hireDate || emp.hireDate || null,
                            employeeStatus: existingUser.employeeStatus || emp.status || 'ACTIVE',
                        },
                    });
                    idMap.set(emp.id, existingUser.id);
                    results.linked++;
                } else {
                    // Create: new User from Employee data
                    const newUser = await prisma.user.create({
                        data: {
                            tenantId,
                            name: `${emp.firstName} ${emp.lastName}`.trim(),
                            email: emp.email,
                            phone: emp.phone || null,
                            role: 'TENANT_ENTERPRISE_WORKFORCE',
                            hourlyCost: emp.hourlyCost,
                            hireDate: emp.hireDate,
                            employeeStatus: emp.status || 'ACTIVE',
                            invitedBy: user.id,
                            invitedAt: new Date(),
                            inviteAccepted: false,
                        },
                    });
                    idMap.set(emp.id, newUser.id);
                    results.created++;
                }
            } catch (err) {
                results.errors.push(`${emp.email}: ${String(err)}`);
            }
        }

        // ── Remap userId references from Employee.id → User.id ────────────
        for (const [oldId, newId] of idMap) {
            if (oldId === newId) continue; // Already the same ID (shouldn't happen, but safe)

            try {
                // Remap ScheduledShift.userId
                const shifts = await prisma.scheduledShift.updateMany({
                    where: { tenantId, userId: oldId },
                    data: { userId: newId },
                });
                results.shiftsRemapped += shifts.count;
            } catch { /* table might not have matching records */ }

            try {
                // Remap ClockEntry.userId
                const clock = await prisma.clockEntry.updateMany({
                    where: { tenantId, userId: oldId },
                    data: { userId: newId },
                });
                results.clockEntriesRemapped += clock.count;
            } catch { /* silent */ }

            try {
                // Remap TimeOffRequest.userId
                const timeOff = await prisma.timeOffRequest.updateMany({
                    where: { tenantId, userId: oldId },
                    data: { userId: newId },
                });
                results.timeOffRemapped += timeOff.count;
            } catch { /* silent */ }

            try {
                // Remap HrTeamMember.userId
                const members = await prisma.hrTeamMember.updateMany({
                    where: { userId: oldId },
                    data: { userId: newId },
                });
                results.teamMembersRemapped += members.count;
            } catch { /* silent */ }
        }

        console.log(`[Link Employees] Tenant ${tenantId}:`, JSON.stringify(results));

        return NextResponse.json({
            success: true,
            total: employees.length,
            ...results,
        });
    } catch (error: unknown) {
        console.error('[Link Employees] Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
