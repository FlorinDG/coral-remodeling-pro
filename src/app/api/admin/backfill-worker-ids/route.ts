/**
 * Backfill Worker IDs — Corrects ClockEntry.userId and ScheduledShift.userId
 * where they hold Employee.id instead of User.id.
 *
 * GET  = dry-run: count + list affected rows WITHOUT mutating
 * POST = apply:   replace Employee.id → Employee.userId, log every change
 *
 * Tenant-scoped, admin-only, idempotent.
 * Florin-gated: run GET first, review, then POST.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

async function getAdminContext() {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) return null;
    const adminRoles = ['TENANT_ADMIN', 'SUPERADMIN', 'TENANT_OWNER', 'TENANT_PRO_OWNER', 'TENANT_ENTERPRISE_OWNER'];
    if (!adminRoles.includes(user.role || '')) return null;
    return { userId: user.id || '', tenantId: user.tenantId };
}

// ── GET: DRY RUN ──────────────────────────────────────────────────────────
export async function GET() {
    const ctx = await getAdminContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized / not admin' }, { status: 401 });

    // Build Employee.id → Employee.userId map for this tenant
    const employees = await prisma.employee.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, userId: true, firstName: true, lastName: true },
    });

    const empIdToUserId = new Map<string, string>();
    const unfixable: Array<{ employeeId: string; name: string; reason: string }> = [];

    for (const emp of employees) {
        if (emp.userId) {
            empIdToUserId.set(emp.id, emp.userId);
        } else {
            unfixable.push({
                employeeId: emp.id,
                name: `${emp.firstName} ${emp.lastName}`,
                reason: 'Employee has no linked user account (userId is null)',
            });
        }
    }

    // Find ClockEntries where userId matches an Employee.id
    const allClockEntries = await prisma.clockEntry.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, userId: true, clockInTime: true },
    });

    const clockEntryFixes: Array<{ id: string; currentUserId: string; correctUserId: string; clockInTime: Date }> = [];
    const clockEntryUnfixable: Array<{ id: string; currentUserId: string; clockInTime: Date; reason: string }> = [];

    for (const entry of allClockEntries) {
        if (empIdToUserId.has(entry.userId)) {
            // This userId is an Employee.id — it needs fixing
            clockEntryFixes.push({
                id: entry.id,
                currentUserId: entry.userId,
                correctUserId: empIdToUserId.get(entry.userId)!,
                clockInTime: entry.clockInTime,
            });
        }
        // Check if it's an Employee.id without a linked user
        const noLinkEmp = employees.find(e => e.id === entry.userId && !e.userId);
        if (noLinkEmp) {
            clockEntryUnfixable.push({
                id: entry.id,
                currentUserId: entry.userId,
                clockInTime: entry.clockInTime,
                reason: `Employee "${noLinkEmp.firstName} ${noLinkEmp.lastName}" has no linked user account`,
            });
        }
    }

    // Find ScheduledShifts where userId matches an Employee.id
    const allShifts = await prisma.scheduledShift.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, userId: true, shiftDate: true },
    });

    const shiftFixes: Array<{ id: string; currentUserId: string; correctUserId: string; shiftDate: string }> = [];
    const shiftUnfixable: Array<{ id: string; currentUserId: string; shiftDate: string; reason: string }> = [];

    for (const shift of allShifts) {
        if (empIdToUserId.has(shift.userId)) {
            shiftFixes.push({
                id: shift.id,
                currentUserId: shift.userId,
                correctUserId: empIdToUserId.get(shift.userId)!,
                shiftDate: shift.shiftDate,
            });
        }
        const noLinkEmp = employees.find(e => e.id === shift.userId && !e.userId);
        if (noLinkEmp) {
            shiftUnfixable.push({
                id: shift.id,
                currentUserId: shift.userId,
                shiftDate: shift.shiftDate,
                reason: `Employee "${noLinkEmp.firstName} ${noLinkEmp.lastName}" has no linked user account`,
            });
        }
    }

    return NextResponse.json({
        dryRun: true,
        tenant: ctx.tenantId,
        summary: {
            clockEntriesToFix: clockEntryFixes.length,
            shiftsToFix: shiftFixes.length,
            clockEntriesUnfixable: clockEntryUnfixable.length,
            shiftsUnfixable: shiftUnfixable.length,
            employeesWithoutUser: unfixable.length,
        },
        clockEntryFixes,
        shiftFixes,
        unfixable: {
            employees: unfixable,
            clockEntries: clockEntryUnfixable,
            shifts: shiftUnfixable,
        },
    });
}

// ── POST: APPLY ───────────────────────────────────────────────────────────
export async function POST() {
    const ctx = await getAdminContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized / not admin' }, { status: 401 });

    const employees = await prisma.employee.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, userId: true, firstName: true, lastName: true },
    });

    const empIdToUserId = new Map<string, string>();
    for (const emp of employees) {
        if (emp.userId) empIdToUserId.set(emp.id, emp.userId);
    }

    // Fix ClockEntries
    const clockEntryResults: Array<{ id: string; old: string; new: string }> = [];
    const allClockEntries = await prisma.clockEntry.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, userId: true },
    });

    for (const entry of allClockEntries) {
        const correctUserId = empIdToUserId.get(entry.userId);
        if (correctUserId) {
            await prisma.clockEntry.update({
                where: { id: entry.id },
                data: { userId: correctUserId },
            });
            clockEntryResults.push({ id: entry.id, old: entry.userId, new: correctUserId });
        }
    }

    // Fix ScheduledShifts
    const shiftResults: Array<{ id: string; old: string; new: string }> = [];
    const allShifts = await prisma.scheduledShift.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, userId: true },
    });

    for (const shift of allShifts) {
        const correctUserId = empIdToUserId.get(shift.userId);
        if (correctUserId) {
            await prisma.scheduledShift.update({
                where: { id: shift.id },
                data: { userId: correctUserId },
            });
            shiftResults.push({ id: shift.id, old: shift.userId, new: correctUserId });
        }
    }

    console.log(`[BACKFILL] Tenant ${ctx.tenantId}: Fixed ${clockEntryResults.length} clock entries, ${shiftResults.length} shifts`);

    return NextResponse.json({
        applied: true,
        tenant: ctx.tenantId,
        appliedBy: ctx.userId,
        appliedAt: new Date().toISOString(),
        clockEntriesFixed: clockEntryResults.length,
        shiftsFixed: shiftResults.length,
        details: {
            clockEntries: clockEntryResults,
            shifts: shiftResults,
        },
    });
}
