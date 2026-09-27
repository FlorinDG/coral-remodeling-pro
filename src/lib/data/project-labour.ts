"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { computeWorkedDuration } from "@/lib/computeWorkedDuration";

export interface ProjectLabourScope {
    tenantId?: string | null;
}

export interface ProjectLabourSummary {
    hours: number;
    entryCount: number;
    shiftCount: number;
    byWorker: { userId: string; hours: number }[];
    shifts: { id: string; shiftDate: string; workerIds: string[] }[];
}

/**
 * Server-side labour aggregation for a project.
 *
 * Traverses ClockEntry.shift relation directly to project.
 * Excludes entries without a linked shift or spanning a deleted shift.
 * Only uses camelCase projectId.
 */
export async function labourForProject(
    scopeOrProjectRef: ProjectLabourScope | string,
    maybeProjectRef?: string,
    client: any = prisma
): Promise<ProjectLabourSummary> {
    let tenantId: string | undefined;
    let projectRef: string | undefined;

    if (typeof scopeOrProjectRef === "string") {
        projectRef = scopeOrProjectRef;
        const session = await auth();
        tenantId = session?.user?.tenantId || undefined;
    } else {
        tenantId = scopeOrProjectRef?.tenantId || undefined;
        if (!tenantId) {
            const session = await auth();
            tenantId = session?.user?.tenantId || undefined;
        }
        projectRef = maybeProjectRef;
    }

    if (!tenantId) {
        throw new Error("Unauthorized: Tenant context missing");
    }

    if (!projectRef) {
        return {
            hours: 0,
            entryCount: 0,
            shiftCount: 0,
            byWorker: [],
            shifts: [],
        };
    }

    // 1. Fetch scheduled shifts for this project (projectId only)
    const projectShifts = await client.scheduledShift.findMany({
        where: {
            tenantId,
            projectId: projectRef,
        },
        select: {
            id: true,
            shiftDate: true,
            workerIds: true,
        },
        orderBy: {
            shiftDate: 'asc',
        },
    });

    // 2. Fetch clock entries traversing declared relation ClockEntry.shift
    // Entries spanning a deleted shift (shiftId is null) are automatically excluded
    const entries = await client.clockEntry.findMany({
        where: {
            tenantId,
            clockOutTime: { not: null },
            shift: {
                projectId: projectRef,
                tenantId,
            },
        },
        select: {
            id: true,
            userId: true,
            clockInTime: true,
            clockOutTime: true,
            noBreak: true,
        },
    });

    if (entries.length === 0) {
        return {
            hours: 0,
            entryCount: 0,
            shiftCount: projectShifts.length,
            byWorker: [],
            shifts: projectShifts,
        };
    }

    let totalWorkedMinutes = 0;
    const workerMinutesMap: Record<string, number> = {};

    for (const entry of entries) {
        const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
        totalWorkedMinutes += duration.totalMinutes;
        if (entry.userId) {
            workerMinutesMap[entry.userId] = (workerMinutesMap[entry.userId] || 0) + duration.totalMinutes;
        }
    }

    const hours = Math.round((totalWorkedMinutes / 60) * 100) / 100;
    const byWorker = Object.entries(workerMinutesMap).map(([userId, mins]) => ({
        userId,
        hours: Math.round((mins / 60) * 100) / 100,
    }));

    return {
        hours,
        entryCount: entries.length,
        shiftCount: projectShifts.length,
        byWorker,
        shifts: projectShifts,
    };
}
