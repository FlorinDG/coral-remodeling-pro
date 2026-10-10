import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { scopeFromSession } from '@/lib/data/scope';
import { resolveReach } from '@/app/api/hr/lib/actor-reach';
import { resolveProjects } from '@/lib/data/projects';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { resolveWorkerUserId } from '@/lib/resolveWorkerIdentity';
import { ClockEntry } from '@prisma/client';
import { zonedParts } from '@/lib/kernel/shift-time';
import { businessPeriod, periodQueryWindow, inBusinessPeriod } from '@/lib/records/business-period';
/** The By Project group of hours with no project — the page matches entries to it by the same key. */
const UNATTRIBUTED = 'unattributed';

type ExtendedClockEntry = ClockEntry & {
    projectId?: string | null;
    billable?: boolean;
    costRateApplied?: number | null;
    noBreak?: boolean;
};

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
    const db = await scopeFromSession();

    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    
    // RBAC: Only get data for users this requester is allowed to see
    // Gate 2 — one authority (actor-reach.ts): tenant HR roles see the tenant, others their reach.
    const reach = await resolveReach(ctx);
    let allowedUserIds: string[] | null = null;
    if (reach.userIds !== null) {
        allowedUserIds = Array.from(reach.userIds);
    }
    
    // Filtering
    const requestedWorkerIds = url.searchParams.getAll('workerIds[]');
    const requestedProjectIds = url.searchParams.getAll('projectIds[]');
    const approvalStatus = url.searchParams.get('approvalStatus');
    const billableParam = url.searchParams.get('billable');
    const sourceParam = url.searchParams.get('source');

    let targetUserIds = allowedUserIds;
    if (requestedWorkerIds.length > 0) {
        // Intersect requested with allowed
        if (allowedUserIds) {
            targetUserIds = requestedWorkerIds.filter(id => allowedUserIds!.includes(id));
            if (targetUserIds.length === 0) {
                return NextResponse.json({
                    entries: [],
                    rollups: { byWorker: [], byProject: [], byWorkerProject: [], byDay: [] },
                    summary: { totalHours: 0, billableHours: 0, internalHours: 0, approvedHours: 0, pendingHours: 0, openEntries: 0 }
                });
            }
        } else {
            targetUserIds = requestedWorkerIds;
        }
    }

    const where: any = {
        tenantId: ctx.tenantId,
    };
    if (targetUserIds) {
        where.userId = { in: targetUserIds };
    }

    // TS-PERIOD-1: the period is BUSINESS days (lib/records/business-period) — the last day whole, Brussels midnight.
    const period = businessPeriod(fromParam, toParam);
    const window = periodQueryWindow(period);
    if (window) where.clockInTime = window;

    if (requestedProjectIds.length > 0) {
        where.projectId = { in: requestedProjectIds };
    }
    
    // TS-ARCH-1: archived hours leave every view except their own chip.
    where.archivedAt = approvalStatus === 'archived' ? { not: null } : null;

    // Status chips (TS-INV-1): approved = approved and NOT yet invoiced · invoiced · nonBillable.
    if (approvalStatus === 'archived') {
        // archived: any status
    } else if (approvalStatus === 'invoiced') {
        where.invoicedAt = { not: null };
    } else if (approvalStatus === 'nonBillable') {
        where.billable = false;
    } else if (approvalStatus === 'approved') {
        where.approvalStatus = 'approved';
        where.invoicedAt = null;
    } else if (approvalStatus) {
        where.approvalStatus = approvalStatus;
    }
    
    if (billableParam !== null) {
        where.billable = billableParam === 'true';
    }

    if (sourceParam) {
        where.source = sourceParam;
    }

    // Fetch entries
    const entries = (await db.clockEntry.findMany({
        where,
        orderBy: { clockInTime: 'desc' }   // Florin 2026-10-10: the latest on top (flat and grouped lists alike)
    })).filter(e => inBusinessPeriod(e.clockInTime, period));

    // Count entries without date bounds to see if they exist outside the period
    const whereWithoutDates = { ...where };
    delete whereWithoutDates.clockInTime;
    const outsidePeriodCount = await db.clockEntry.count({
        where: whereWithoutDates
    });

    // We also need employees to get names. User table is the unified source of truth.
    const users = await db.user.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, name: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // We need projects for names
    // PROJ-SSOT-1: the one resolver (was HrProject — zero rows → the by-project rollup grouped nothing).
    const projMap = new Map((await resolveProjects(ctx.tenantId)).map(p => [p.id, p]));

    // Process entries and build rollups
    const processedEntries = [];
    let totalHours = 0;
    let billableHours = 0;
    let internalHours = 0;
    let approvedHours = 0;
    let invoicedHours = 0;
    let selfApprovedHours = 0;
    let pendingHours = 0;
    let deniedHours = 0;
    let openEntries = 0;

    const byWorkerMap = new Map<string, any>();
    const byProjectMap = new Map<string, any>();
    const byWorkerProjectMap = new Map<string, any>();
    const byDayMap = new Map<string, any>();

    for (const rawEntry of entries) {
        const entry = rawEntry as ExtendedClockEntry;
        const user = userMap.get(entry.userId);
        const workerName = user?.name ? user.name : 'Unknown';
        
        const approver = entry.approvedBy ? userMap.get(entry.approvedBy) : null;
        const approverName = approver?.name || null;
        const creator = entry.createdBy ? userMap.get(entry.createdBy) : null;
        const createdByName = creator?.name || null;

        const proj = entry.projectId ? projMap.get(entry.projectId) : null;
        const projectName = proj ? proj.name : (entry.projectId ? 'Unknown Project' : 'Unattributed');

        const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
        const hoursDecimal = duration.totalMinutes / 60;

        const dayStr = zonedParts(entry.clockInTime).date;   // the business day, never UTC

        const flags: string[] = [];
        if (entry.source === 'manual') flags.push('manual');
        if (entry.source === 'adjusted') flags.push('adjusted');
        if (!entry.clockOutTime) flags.push('missing clock-out');
        // Basic inference for late/off-geofence could go here if we fetch shift details

        const processed = {
            ...entry,
            workerName,
            projectName,
            approverName,
            createdByName,
            notes: (entry as any).notes || null,
            duration,
            hoursDecimal,
            flags
        };
        processedEntries.push(processed);

        // Rollups: EVERY entry belongs to its worker and project group (an open one too — it was missing from the
        // By Worker / By Project views); only closed hours are added.
        const closedHours = entry.clockOutTime ? hoursDecimal : 0;
        if (!byWorkerMap.has(entry.userId)) {
            byWorkerMap.set(entry.userId, { userId: entry.userId, workerName, hours: 0, billableHours: 0 });
        }
        const w = byWorkerMap.get(entry.userId);
        w.hours += closedHours;
        if (entry.billable && entry.projectId) w.billableHours += closedHours;

        const pId = entry.projectId || UNATTRIBUTED;
        if (!byProjectMap.has(pId)) {
            byProjectMap.set(pId, { projectId: pId, projectName, hours: 0 });
        }
        byProjectMap.get(pId).hours += closedHours;

        const wpId = `${entry.userId}-${pId}`;
        if (!byWorkerProjectMap.has(wpId)) {
            byWorkerProjectMap.set(wpId, { userId: entry.userId, workerName, projectId: pId, projectName, hours: 0 });
        }
        byWorkerProjectMap.get(wpId).hours += closedHours;

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
                if (entry.invoicedAt) invoicedHours += hoursDecimal;
                if (entry.approvedBy && entry.approvedBy === entry.createdBy) {
                    selfApprovedHours += hoursDecimal;
                }
            } else if (entry.approvalStatus === 'denied') {
                deniedHours += hoursDecimal;
            } else {
                pendingHours += hoursDecimal;   // to review: pending (or never asked)
            }

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
            invoicedHours: Math.round(invoicedHours * 100) / 100,
            selfApprovedHours: Math.round(selfApprovedHours * 100) / 100,
            pendingHours: Math.round(pendingHours * 100) / 100,
            deniedHours: Math.round(deniedHours * 100) / 100,
            openEntries,
            outsidePeriodCount,
        }
    });
}
