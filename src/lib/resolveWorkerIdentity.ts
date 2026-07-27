/**
 * Worker Identity Resolution
 * 
 * The HR system has two identity domains:
 *   - Employee.id   — the HR record identifier
 *   - User.id       — the auth/session identifier
 * 
 * ClockEntry.userId and ScheduledShift.userId must ALWAYS hold the User.id.
 * This module provides the canonical lookup in both directions so no caller
 * ever has to guess which id domain they're in.
 */

import prisma from '@/lib/prisma';

export interface WorkerIdentity {
    userId: string;      // User.id — the canonical id for ClockEntry/ScheduledShift
    employeeId: string;  // Employee.id — the HR record id
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    hourlyCost: number | null;
}

/**
 * Given an Employee.id, resolve the linked User.id.
 * Throws if the employee has no linked user account — callers must not
 * fall back to writing the Employee.id, which is the bug this fixes.
 */
export async function resolveWorkerUserId(employeeId: string): Promise<string> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { userId: true, firstName: true, lastName: true },
    });

    if (!employee) {
        throw new Error(`Employee not found: ${employeeId}`);
    }

    if (!employee.userId) {
        throw new Error(
            `Employee "${employee.firstName} ${employee.lastName}" (${employeeId}) has no linked user account. ` +
            `Link this employee to a user in HR → Employees before assigning shifts or clock entries.`
        );
    }

    return employee.userId;
}

/**
 * Given a User.id, resolve the Employee record.
 * Returns null if no Employee is linked (the user exists but has no HR profile).
 */
export async function resolveEmployeeForUser(
    userId: string,
    tenantId: string
): Promise<WorkerIdentity | null> {
    const employee = await prisma.employee.findFirst({
        where: { userId, tenantId },
        select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
            hourlyCost: true,
        },
    });

    if (!employee || !employee.userId) return null;

    return {
        userId: employee.userId,
        employeeId: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        email: employee.email,
        hourlyCost: employee.hourlyCost,
    };
}

/**
 * Batch-resolve: given a list of Employee records (as returned by the HR API),
 * return a map of Employee.id → User.id for all employees that have a linked user.
 * Employees without a userId are excluded from the map — callers should filter them out.
 */
export function buildEmployeeToUserMap(
    employees: Array<{ id: string; userId?: string | null }>
): Map<string, string> {
    const map = new Map<string, string>();
    for (const emp of employees) {
        if (emp.userId) {
            map.set(emp.id, emp.userId);
        }
    }
    return map;
}
