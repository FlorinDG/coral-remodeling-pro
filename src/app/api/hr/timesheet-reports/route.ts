import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getAccessibleUserIds } from '@/app/api/hr/lib/team-scoping';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { resolveWorkerUserId } from '@/lib/resolveWorkerIdentity';

async function getContext(req: Request) {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) return null;
    return {
        userId: user.id || '',
        tenantId: user.tenantId,
        role: user.role || 'USER',
    };
}

export async function GET(req: Request) {
    const ctx = await getContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    
    // RBAC: Only get data for users this requester is allowed to see
    const allowedUserIds = await getAccessibleUserIds(ctx.tenantId, ctx.userId);
    
    // Filtering
    const requestedWorkerIds = url.searchParams.getAll('workerIds[]');
    const requestedProjectIds = url.searchParams.getAll('projectIds[]');
    const approvalStatus = url.searchParams.get('approvalStatus');
    const billableParam = url.searchParams.get('billable');
    const sourceParam = url.searchParams.get('source');

    let targetUserIds = allowedUserIds;
    if (requestedWorkerIds.length > 0) {
        // Intersect requested with allowed
        targetUserIds = requestedWorkerIds.filter(id => allowedUserIds.includes(id));
        if (targetUserIds.length === 0) {
            return NextResponse.json({
                entries: [],
                rollups: { byWorker: [], byProject: [], byWorkerProject: [], byDay: [] },
                summary: { totalHours: 0, billableHours: 0, internalHours: 0, approvedHours: 0, pendingHours: 0, openEntries: 0 }
            });
        }
    }

    const where: any = {
        tenantId: ctx.tenantId,
        userId: { in: targetUserIds },
    };

    if (fromParam && toParam) {
        where.clockInTime = {
            gte: new Date(fromParam),
            lte: new Date(toParam)
        };
    } else if (fromParam) {
        where.clockInTime = { gte: new Date(fromParam) };
    } else if (toParam) {
        where.clockInTime = { lte: new Date(toParam) };
    }

    if (requestedProjectIds.length > 0) {
        where.projectId = { in: requestedProjectIds };
    }
    
    if (approvalStatus) {
        where.approvalStatus = approvalStatus;
    }
    
    if (billableParam !== null) {
        where.billable = billableParam === 'true';
    }

    if (sourceParam) {
        where.source = sourceParam;
    }

    // Fetch entries
    const entries = await prisma.clockEntry.findMany({
        where,
        orderBy: { clockInTime: 'asc' }
    });

    // We also need employees to get names & cost rates
    const employees = await prisma.employee.findMany({
        where: { tenantId: ctx.tenantId, userId: { in: targetUserIds } },
        select: { userId: true, firstName: true, lastName: true, hourlyCost: true }
    });
    const empMap = new Map(employees.map(e => [e.userId, e]));

    // We need projects for names
    const projects = await prisma.hrProject.findMany({
        where: { tenantId: ctx.tenantId }
    });
    const projMap = new Map(projects.map((p: any) => [p.id, p]));

    // Process entries and build rollups
    const processedEntries = [];
    let totalHours = 0;
    let billableHours = 0;
    let internalHours = 0;
    let approvedHours = 0;
    let pendingHours = 0;
    let openEntries = 0;

    const byWorkerMap = new Map<string, any>();
    const byProjectMap = new Map<string, any>();
    const byWorkerProjectMap = new Map<string, any>();
    const byDayMap = new Map<string, any>();

    for (const rawEntry of entries) {
        const entry = rawEntry as any;
        const emp = empMap.get(entry.userId);
        const workerName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Unknown';
        
        const proj = entry.projectId ? projMap.get(entry.projectId) : null;
        const projectName = proj ? proj.name : (entry.projectId ? 'Unknown Project' : 'Unattributed');

        const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
        const hoursDecimal = duration.totalMinutes / 60;

        const dayStr = entry.clockInTime.toISOString().split('T')[0];

        const processed = {
            ...entry,
            workerName,
            projectName,
            duration,
            hoursDecimal
        };
        processedEntries.push(processed);

        if (!entry.clockOutTime) {
            openEntries++;
        } else {
            totalHours += hoursDecimal;
            
            // Note: entry.projectId === null means it's unattributed, which shouldn't count as billable
            if (entry.billable && entry.projectId) {
                billableHours += hoursDecimal;
            } else {
                internalHours += hoursDecimal;
            }

            if (entry.approvalStatus === 'approved') {
                approvedHours += hoursDecimal;
            } else {
                pendingHours += hoursDecimal;
            }

            // Worker Rollup
            if (!byWorkerMap.has(entry.userId)) {
                byWorkerMap.set(entry.userId, { userId: entry.userId, workerName, hours: 0, billableHours: 0 });
            }
            const w = byWorkerMap.get(entry.userId);
            w.hours += hoursDecimal;
            if (entry.billable && entry.projectId) w.billableHours += hoursDecimal;

            // Project Rollup
            const pId = entry.projectId || 'unattributed';
            if (!byProjectMap.has(pId)) {
                byProjectMap.set(pId, { projectId: pId, projectName, hours: 0 });
            }
            byProjectMap.get(pId).hours += hoursDecimal;

            // Worker x Project Rollup
            const wpId = `${entry.userId}-${pId}`;
            if (!byWorkerProjectMap.has(wpId)) {
                byWorkerProjectMap.set(wpId, { userId: entry.userId, workerName, projectId: pId, projectName, hours: 0 });
            }
            byWorkerProjectMap.get(wpId).hours += hoursDecimal;

            // Day Rollup
            if (!byDayMap.has(dayStr)) {
                byDayMap.set(dayStr, { date: dayStr, hours: 0 });
            }
            byDayMap.get(dayStr).hours += hoursDecimal;
        }
    }

    return NextResponse.json({
        entries: processedEntries,
        rollups: {
            byWorker: Array.from(byWorkerMap.values()),
            byProject: Array.from(byProjectMap.values()),
            byWorkerProject: Array.from(byWorkerProjectMap.values()),
            byDay: Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        },
        summary: {
            totalHours: Math.round(totalHours * 100) / 100,
            billableHours: Math.round(billableHours * 100) / 100,
            internalHours: Math.round(internalHours * 100) / 100,
            approvedHours: Math.round(approvedHours * 100) / 100,
            pendingHours: Math.round(pendingHours * 100) / 100,
            openEntries,
        }
    });
}
