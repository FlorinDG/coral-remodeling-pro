"use server";

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
            clockEntryId: { in: clockEntryIds.length > 0 ? clockEntryIds : ['no-match'] }
        },
        select: {
            clockEntryId: true,
            projectId: true,
            // project: { select: { name: true } } // project relation doesn't exist on scheduledShift in prisma? Let's check schema.
        }
    });

    // Wait, in Supabase it was: projects(name)
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
        if (shift.clockEntryId) {
            shiftProjectMap.set(shift.clockEntryId, {
                project_id: shift.projectId,
                project_name: shift.projectId ? (projectNames[shift.projectId] || 'Unknown Project') : null
            });
        }
    });

    // We map back to snake_case or camelCase as expected by the component.
    // The component expects snake_case for Supabase compatibility, let's map it.
    return clockData.map(c => {
        const proj = shiftProjectMap.get(c.id);
        return {
            id: c.id,
            clock_in_time: c.clockInTime.toISOString(),
            clock_out_time: c.clockOutTime ? c.clockOutTime.toISOString() : null,
            task_description: c.taskDescription,
            project_id: proj?.project_id || null,
            project_name: proj?.project_name || null
        };
    });
}
