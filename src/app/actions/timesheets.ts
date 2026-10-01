"use server";

import { isTenantHrRole } from '@/lib/roles';
import { zonedParts, isShiftSubmitted } from '@/lib/kernel/shift-time';
import { autoLinkIfUnique } from '@/lib/data/entry-shift-match';
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function getTimesheetData(targetUserId: string, startIso: string, endIso: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
        throw new Error("No tenant context");
    }

    // Role check to ensure the user can view targetUserId's timesheets
    const role = (session.user as any).role || 'USER';
    const isAdminRole = ['TENANT_ADMIN', 'SUPERADMIN', 'ACCOUNTANT', 'APP_MANAGER', 'TENANT_OWNER', 'TENANT_PRO_OWNER', 'TENANT_ENTERPRISE_OWNER', 'TENANT_ENTERPRISE_ADMIN'].includes(role);
    
    if (!isAdminRole && session.user.id !== targetUserId) {
        throw new Error("Unauthorized to view this user's timesheets");
    }

    // Fetch clock entries
    const clockData = await prisma.clockEntry.findMany({
        where: {
            tenantId,
            userId: targetUserId,
            clockInTime: {
                gte: new Date(startIso),
                lte: new Date(endIso)
            }
        },
        select: {
            id: true,
            clockInTime: true,
            clockOutTime: true,
            taskDescription: true
        },
        orderBy: {
            clockInTime: 'asc'
        }
    });

    const clockEntryIds = clockData.map(c => c.id);

    // Fetch related shifts
    const shiftsData = await prisma.scheduledShift.findMany({
        where: {
            id: { in: clockEntryIds.length > 0 ? clockEntryIds : ['no-match'] }
        },
        select: {
            id: true,
            projectId: true,
            // project: { select: { name: true } } // project relation doesn't exist on scheduledShift in prisma? Let's check schema.
        }
    });

    // We'll need to fetch the project names. ScheduledShift has projectId.
    // If projectId points to GlobalPage, we need to fetch GlobalPages.
    const projectIds = Array.from(new Set(shiftsData.map(s => s.projectId).filter(Boolean))) as string[];
    let projectNames: Record<string, string> = {};

    if (projectIds.length > 0) {
        // Find internal projects first
        const internal = await prisma.internalProject.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, name: true }
        });
        
        // Find dynamic projects
        const dynamic = await prisma.globalPage.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, properties: true }
        });

        internal.forEach(p => projectNames[p.id] = p.name);
        dynamic.forEach(p => {
            const props = p.properties as any;
            projectNames[p.id] = String(props?.title || props?.name || 'Untitled');
        });
    }

    const shiftProjectMap = new Map<string, { project_id: string | null; project_name: string | null }>();
    shiftsData.forEach(shift => {
        if (shift.id) {
            shiftProjectMap.set(shift.id, {
                project_id: shift.projectId,
                project_name: shift.projectId ? (projectNames[shift.projectId] || 'Unknown Project') : null
            });
        }
    });

    // We map back to snake_case or camelCase as expected by the component.
    return clockData.map(c => {
        const proj = shiftProjectMap.get(c.id);
        return {
            id: c.id,
            clockInTime: c.clockInTime.toISOString(),
            clockOutTime: c.clockOutTime ? c.clockOutTime.toISOString() : null,
            taskDescription: c.taskDescription,
            projectId: proj?.project_id || null,
            projectName: proj?.project_name || null,
            clock_in_time: c.clockInTime.toISOString(),
            clock_out_time: c.clockOutTime ? c.clockOutTime.toISOString() : null,
            task_description: c.taskDescription,
            project_id: proj?.project_id || null,
            project_name: proj?.project_name || null
        };
    });
}

export async function getProjectScheduledShifts(projectId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
        throw new Error("No tenant context");
    }

    const shifts = await prisma.scheduledShift.findMany({
        where: { projectId, tenantId },
        orderBy: { shiftDate: 'asc' }
    });

    const employeeIds = Array.from(new Set(shifts.map(s => s.userId).filter(Boolean))) as string[];

    const employees = await prisma.employee.findMany({
        where: {
            userId: { in: employeeIds },
            tenantId
        },
        select: {
            userId: true,
            firstName: true,
            lastName: true
        }
    });

    const empMap = new Map(employees.map(e => [e.userId, `${e.firstName} ${e.lastName}`]));

    return shifts.map(s => ({
        id: s.id,
        employeeName: empMap.get(s.userId) || s.userId,
        shiftDate: s.shiftDate,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        role: s.role || null,
        status: s.status
    }));
}

export async function getProjectLaborStats(projectId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) throw new Error("No tenant context");

    const shifts = await prisma.scheduledShift.findMany({
        where: { projectId, tenantId }
    });

    const employeeIds = Array.from(new Set(shifts.map(s => s.userId).filter(Boolean))) as string[];

    const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds }, tenantId },
        select: { id: true, hourlyCost: true }
    });

    const ratesMap = new Map(employees.map(e => [e.id, e.hourlyCost || 0]));

    let totalQuotedHours = 0;
    let totalQuotedCost = 0;

    const parseTimeToHours = (timeStr: string): number => {
        const [h, m] = timeStr.split(':').map(Number);
        return (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m) / 60;
    };

    shifts.forEach(s => {
        if (!s.shiftStart || !s.shiftEnd) return;
        const start = parseTimeToHours(s.shiftStart);
        const end = parseTimeToHours(s.shiftEnd);
        const hours = Math.max(0, end - start);
        const rate = ratesMap.get(s.userId) || 0;
        totalQuotedHours += hours;
        totalQuotedCost += hours * rate;
    });

    const shiftIds = shifts.map(s => s.id);
    const clockEntries = await prisma.clockEntry.findMany({
        where: { shiftId: { in: shiftIds }, tenantId }
    });

    const userIds = Array.from(new Set(clockEntries.map(c => c.userId).filter(Boolean))) as string[];
    const users = await prisma.user.findMany({
        where: { id: { in: userIds }, tenantId },
        select: { id: true, hourlyCost: true }
    });
    const userRatesMap = new Map(users.map(u => [u.id, u.hourlyCost || 0]));

    let totalRealizedHours = 0;
    let totalRealizedCost = 0;

    clockEntries.forEach(c => {
        if (!c.clockInTime || !c.clockOutTime) return;
        const hours = Math.max(0, (c.clockOutTime.getTime() - c.clockInTime.getTime()) / (1000 * 60 * 60));
        const rate = userRatesMap.get(c.userId) || ratesMap.get(c.userId) || 0;
        totalRealizedHours += hours;
        totalRealizedCost += hours * rate;
    });

    return {
        quotedHours: totalQuotedHours,
        quotedCost: totalQuotedCost,
        realizedHours: totalRealizedHours,
        realizedCost: totalRealizedCost
    };
}

export async function submitLateEntry(params: {
    targetUserId: string;
    clockInTime: string;
    clockOutTime: string;
    includeLocation?: boolean;
    location?: { lat: number; lng: number; address: string };
    taskDescription?: string;
    projectId?: string | null;
    taskId?: string | null;
    filesCount?: number;
    filesData?: any;
    /** WO-1: hours added from inside a shift (the Hours tab) belong to THAT shift. */
    shiftId?: string | null;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) throw new Error("No tenant context");

    const { targetUserId, clockInTime, clockOutTime, includeLocation, location, taskDescription, projectId, taskId, filesData } = params;

    // The client sends INSTANTS (with Z or an offset). A bare "2026-09-28T09:00" was read by this
    // UTC server as 09:00 UTC = 11:00 in Belgium — every late entry landed two hours late.
    const hasZone = (v: string) => /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(v);
    if (!hasZone(clockInTime) || !hasZone(clockOutTime)) {
        throw new Error("Out of date app: please reload and enter the hours again (times arrived without a time zone)");
    }
    if (new Date(clockOutTime).getTime() <= new Date(clockInTime).getTime()) {
        throw new Error("Clock-out must be after clock-in");
    }

    // Gate 2 (same rule as write-policy.ts, second door): a late entry is filed for YOURSELF unless
    // you hold a tenant HR role — and the worker must be a user of THIS tenant (seraph, item 8).
    const role = (session.user as { role?: string }).role;
    if (targetUserId !== session.user.id && !isTenantHrRole(role)) {
        throw new Error("Forbidden: own_records_only");
    }
    const subject = await prisma.user.findFirst({ where: { id: targetUserId, tenantId }, select: { id: true } });
    if (!subject) throw new Error("Not found");

    // WO-1: the shift is named — it must be this worker's, in this tenant, and still open.
    let boundShift: { id: string; projectId: string | null } | null = null;
    if (params.shiftId) {
        const s = await prisma.scheduledShift.findFirst({
            where: { id: params.shiftId, tenantId, userId: targetUserId },
            select: { id: true, projectId: true, status: true },
        });
        if (!s) throw new Error("Not found: shift");
        if (isShiftSubmitted(s.status) && !isTenantHrRole(role)) throw new Error("shift_submitted");
        boundShift = s;
    }

    try {
        let shiftId: string | null = boundShift?.id ?? null;
        if (projectId && !boundShift) {
            // Wall-clock parts in the business zone — toISOString() here was UTC (2h early, wrong day
            // before 02:00). Kernel: zonedParts (Intl + named zone, no offset arithmetic).
            const inLocal = zonedParts(clockInTime);
            const shiftDate = inLocal.date;
            const shiftStart = inLocal.time;
            const shiftEnd = zonedParts(clockOutTime).time;
            const shift = await prisma.scheduledShift.create({
                data: {
                    tenantId,
                    userId: targetUserId,
                    projectId,
                    shiftDate,
                    shiftStart,
                    shiftEnd,
                    // not 'completed': only the crew member's submit completes a shift (2026-09-30)
                    createdBy: session.user.id,
                }
            });
            shiftId = shift.id;
        }

        const clockEntry = await prisma.clockEntry.create({
            data: {
                tenantId,
                userId: targetUserId,
                clockInTime: new Date(clockInTime),
                clockOutTime: new Date(clockOutTime),
                taskDescription,
                projectId: projectId || boundShift?.projectId || null,
                shiftId: shiftId,
                requiresApproval: true,
                approvalStatus: 'pending',
                source: 'late_entry',
                clockInLatitude: location?.lat || null,
                clockInLongitude: location?.lng || null,
                clockOutLatitude: location?.lat || null,
                clockOutLongitude: location?.lng || null,
                photos: filesData || null
            }
        });

        // SHIFT-LINK-1: no project picked → link to the one planned shift these hours overlap, if unique.
        if (!shiftId) {
            try {
                shiftId = await autoLinkIfUnique(clockEntry.id, { tenantId, userId: session.user.id });
            } catch (err) {
                console.error('[submitLateEntry] SHIFT-LINK-1 auto-link failed:', err);
            }
        }

        const entry = await prisma.hrApprovalRequest.create({
            data: {
                tenantId,
                userId: targetUserId,
                requestedBy: session.user.id,
                entityType: 'clock_entry',
                requestType: 'late_entry',
                requestData: {
                    id: clockEntry.id,
                    clockEntryId: clockEntry.id,
                    entityId: clockEntry.id,
                    shiftId,
                    clockInTime,
                    clockOutTime,
                    taskDescription,
                    projectId,
                    taskId,
                    includeLocation,
                    location,
                    filesData
                }
            }
        });

        return { success: true, data: entry, error: null };
    } catch (err: any) {
        console.error("submitLateEntry error:", err);
        return { success: false, data: null, error: err.message };
    }
}
