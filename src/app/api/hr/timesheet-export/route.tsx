import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { resolveReach } from '@/app/api/hr/lib/actor-reach';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import * as XLSX from 'xlsx';
import { ClockEntry } from '@prisma/client';
import { zonedParts } from '@/lib/kernel/shift-time';
import { resolveProjects } from '@/lib/data/projects';
import { isSelfApproved } from '@/lib/provenance';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30 },
    title: { fontSize: 18, marginBottom: 20, fontWeight: 'bold' },
    table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
    tableRow: { margin: 'auto', flexDirection: 'row' },
    tableCol: { width: '14.28%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
    tableCell: { margin: 5, fontSize: 10 },
    tableHeader: { margin: 5, fontSize: 10, fontWeight: 'bold' }
});

type ExtendedClockEntry = ClockEntry & {
    projectId?: string | null;
    billable?: boolean;
    costRateApplied?: number | null;
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
    if (!ctx) return new NextResponse('Unauthorized', { status: 401 });

    const url = new URL(req.url);
    const exportFormat = url.searchParams.get('format') || 'xlsx';
    
    // Parse filters
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const requestedWorkerIds = url.searchParams.getAll('workerIds[]');
    const requestedProjectIds = url.searchParams.getAll('projectIds[]');

    // RBAC: Only get data for users this requester is allowed to see
    // Gate 2 — one authority (actor-reach.ts): tenant HR roles see the tenant, others their reach.
    const reach = await resolveReach(ctx);
    let allowedUserIds: string[] | null = null;
    if (reach.userIds !== null) {
        allowedUserIds = Array.from(reach.userIds);
    }
    
    let targetUserIds = allowedUserIds;
    if (requestedWorkerIds.length > 0) {
        if (allowedUserIds) {
            targetUserIds = requestedWorkerIds.filter(id => allowedUserIds!.includes(id));
            if (targetUserIds.length === 0) {
                return new NextResponse('No accessible users', { status: 403 });
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

    const employeesWhere: any = { tenantId: ctx.tenantId };
    if (targetUserIds) {
        employeesWhere.userId = { in: targetUserIds };
    }
    const employees = await prisma.employee.findMany({
        where: employeesWhere,
        select: { userId: true, firstName: true, lastName: true, hourlyCost: true }
    });
    const empMap = new Map(employees.map(e => [e.userId, e]));

    // PROJ-SSOT-1: the one resolver (was HrProject — zero rows → "Unknown Project" on every attributed line).
    const projMap = new Map((await resolveProjects(ctx.tenantId)).map(p => [p.id, p]));

    const users = await prisma.user.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, name: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Generate Excel File
    const rawData = entries.map((rawEntry) => {
        const entry = rawEntry as ExtendedClockEntry;
        const emp = empMap.get(entry.userId);
        const workerName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Unknown';
        const proj = entry.projectId ? projMap.get(entry.projectId) : null;
        const projectName = proj ? proj.name : (entry.projectId ? 'Unknown Project' : 'Unattributed');
        
        const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
        const hoursDecimal = duration.totalMinutes / 60;
        
        // Stamped cost rate or fallback to current canonical rate
        const costRate = entry.costRateApplied ?? emp?.hourlyCost ?? 0;
        const totalCost = hoursDecimal * costRate;

        const isSelf = isSelfApproved(entry);
        let approverDisplay = '';
        if (entry.approvalStatus === 'approved' && entry.approvedBy) {
            const approverName = userMap.get(entry.approvedBy) || entry.approvedBy;
            approverDisplay = isSelf ? `${approverName} (Zelf goedgekeurd)` : approverName;
        }

        const creatorDisplay = entry.createdBy && entry.source !== 'clocked' ? (userMap.get(entry.createdBy) || entry.createdBy) : '';

        const sourceDisplay = entry.source === 'clocked'
            ? 'Geklokt'
            : entry.source === 'late_entry'
                ? 'Uren manueel toevoegen'
                : entry.source === 'admin_entry'
                    ? 'Beheerdersinvoer'
                    : entry.source === 'Aangepast' || entry.source === 'adjusted'
                        ? 'Aangepast'
                        : (entry.source || 'Geklokt');

        const statusDisplay = entry.approvalStatus === 'approved'
            ? 'Goedgekeurd'
            : entry.approvalStatus === 'denied'
                ? 'Geweigerd'
                : 'Te beoordelen';

        return {
            'ID': entry.id,
            'Medewerker': workerName,
            'Project': projectName,
            // Business wall clock — date-fns format() on the server is UTC (every time 2h early).
            'Datum': zonedParts(entry.clockInTime).date,
            'In': zonedParts(entry.clockInTime).time,
            'Uit': entry.clockOutTime ? zonedParts(entry.clockOutTime).time : '',
            'Uren (Decimaal)': hoursDecimal,
            'Pauze Afgetrokken': duration.breakDeducted ? 'Ja' : 'Nee',
            'Status': statusDisplay,
            'Herkomst': sourceDisplay,
            'Ingevoerd door': creatorDisplay,
            'Goedgekeurd door': approverDisplay,
            'Notities': (entry as any).notes || '',
            'Facturabel': entry.billable ? 'Ja' : 'Nee',
            // Employer cost rates are HR data (tenant checklist item 5) — only on an HR role's export.
            ...(reach.mayApprove ? { 'Kosten per uur': costRate, 'Totale kosten': totalCost } : {}),
        };
    });

    // Build a readable filter string for headers
    const filterParts = [];
    if (fromParam && toParam) filterParts.push(`Period: ${fromParam} to ${toParam}`);
    else filterParts.push(`Period: All time`);
    if (requestedWorkerIds.length > 0) filterParts.push(`Workers: ${requestedWorkerIds.length} selected`);
    if (requestedProjectIds.length > 0) filterParts.push(`Projects: ${requestedProjectIds.length} selected`);
    const filterDescription = `Filters active - ${filterParts.join(' | ')}`;

    if (exportFormat === 'csv') {
        const Papa = require('papaparse');
        const csvString = Papa.unparse(rawData);
        const finalCsv = `${filterDescription}\n\n${csvString}`;
        return new NextResponse(finalCsv, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="timesheet-export-${new Date().toISOString().split('T')[0]}.csv"`,
                'Content-Type': 'text/csv',
            }
        });
    }

    if (exportFormat === 'pdf') {
        const MyDocument = (
            <Document>
                <Page size="A4" style={styles.page}>
                    <Text style={styles.title}>Timesheet Export</Text>
                    <Text style={{ fontSize: 10, marginBottom: 15, color: '#666' }}>{filterDescription}</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>Date</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>Worker</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>Project</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>In</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>Out</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>Hours</Text></View>
                            <View style={styles.tableCol}><Text style={styles.tableHeader}>Status</Text></View>
                        </View>
                        {rawData.map((row: any, i: number) => (
                            <View style={styles.tableRow} key={i}>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['Datum']}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['Medewerker']}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['Project']}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['In']}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['Uit']}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['Uren (Decimaal)'].toFixed(2)}</Text></View>
                                <View style={styles.tableCol}><Text style={styles.tableCell}>{row['Status']}</Text></View>
                            </View>
                        ))}
                    </View>
                </Page>
            </Document>
        );

        const pdfBuffer = await renderToBuffer(MyDocument);
        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="timesheet-export-${new Date().toISOString().split('T')[0]}.pdf"`,
                'Content-Type': 'application/pdf',
            }
        });
    }

    if (exportFormat === 'xlsx') {
        const wb = XLSX.utils.book_new();
        
        // Convert to array of arrays so we can prepend the header row easily
        const headerRow = Object.keys(rawData[0] || {});
        const dataRows = rawData.map(r => Object.values(r));
        const sheetData = [
            [filterDescription],
            [],
            headerRow,
            ...dataRows
        ];
        
        const wsRaw = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, wsRaw, "Alle Uren");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        return new NextResponse(buf as any, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="timesheet-export-${new Date().toISOString().split('T')[0]}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        });
    }

    return new NextResponse('Unsupported format', { status: 400 });
}
