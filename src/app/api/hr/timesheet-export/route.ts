import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getAccessibleUserIds } from '@/app/api/hr/lib/team-scoping';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import * as XLSX from 'xlsx';

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
    if (!ctx) return new NextResponse('Unauthorized', { status: 401 });

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'xlsx';
    
    // Parse filters
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const requestedWorkerIds = url.searchParams.getAll('workerIds[]');
    const requestedProjectIds = url.searchParams.getAll('projectIds[]');

    // RBAC: Only get data for users this requester is allowed to see
    const allowedUserIds = await getAccessibleUserIds(ctx.userId, ctx.tenantId, ctx.role);
    
    let targetUserIds = allowedUserIds;
    if (requestedWorkerIds.length > 0) {
        targetUserIds = requestedWorkerIds.filter(id => allowedUserIds.includes(id));
        if (targetUserIds.length === 0) {
            return new NextResponse('No accessible users', { status: 403 });
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
    }

    if (requestedProjectIds.length > 0) {
        where.projectId = { in: requestedProjectIds };
    }

    // Fetch entries
    const entries = await prisma.clockEntry.findMany({
        where,
        orderBy: { clockInTime: 'asc' }
    });

    const employees = await prisma.employee.findMany({
        where: { tenantId: ctx.tenantId, userId: { in: targetUserIds } },
        select: { userId: true, firstName: true, lastName: true, hourlyCost: true }
    });
    const empMap = new Map(employees.map(e => [e.userId, e]));

    const projects = await prisma.project.findMany({
        where: { tenantId: ctx.tenantId }
    });
    const projMap = new Map(projects.map(p => [p.id, p]));

    // Generate Excel File
    if (format === 'xlsx') {
        const rawData = entries.map(entry => {
            const emp = empMap.get(entry.userId);
            const workerName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Unknown';
            const proj = entry.projectId ? projMap.get(entry.projectId) : null;
            const projectName = proj ? proj.name : (entry.projectId ? 'Unknown Project' : 'Unattributed');
            
            const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
            const hoursDecimal = duration.totalMinutes / 60;
            
            // Stamped cost rate or fallback to current canonical rate
            const costRate = entry.costRateApplied ?? emp?.hourlyCost ?? 0;
            const totalCost = hoursDecimal * costRate;

            return {
                'ID': entry.id,
                'Medewerker': workerName,
                'Project': projectName,
                'Datum': entry.clockInTime.toISOString().split('T')[0],
                'In': entry.clockInTime.toISOString().split('T')[1].slice(0,5),
                'Uit': entry.clockOutTime ? entry.clockOutTime.toISOString().split('T')[1].slice(0,5) : '',
                'Uren (Decimaal)': hoursDecimal,
                'Pauze Afgetrokken': duration.breakDeducted ? 'Ja' : 'Nee',
                'Status': entry.approvalStatus || 'pending',
                'Facturabel': entry.billable ? 'Ja' : 'Nee',
                'Kosten per uur': costRate,
                'Totale kosten': totalCost
            };
        });

        const wb = XLSX.utils.book_new();
        const wsRaw = XLSX.utils.json_to_sheet(rawData);
        XLSX.utils.book_append_sheet(wb, wsRaw, "Alle Uren");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="timesheet-export-${new Date().toISOString().split('T')[0]}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        });
    }

    return new NextResponse('Unsupported format', { status: 400 });
}
