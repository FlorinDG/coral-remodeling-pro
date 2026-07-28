import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getAccessibleUserIds } from '@/app/api/hr/lib/team-scoping';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import * as XLSX from 'xlsx';
import { ClockEntry } from '@prisma/client';
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
    const format = url.searchParams.get('format') || 'xlsx';
    
    // Parse filters
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const requestedWorkerIds = url.searchParams.getAll('workerIds[]');
    const requestedProjectIds = url.searchParams.getAll('projectIds[]');

    // RBAC: Only get data for users this requester is allowed to see
    const isAdminRole = ['TENANT_ADMIN', 'SUPERADMIN', 'ACCOUNTANT', 'APP_MANAGER', 'TENANT_OWNER', 'TENANT_PRO_OWNER', 'TENANT_ENTERPRISE_OWNER', 'TENANT_ENTERPRISE_ADMIN'].includes(ctx.role);
    let allowedUserIds: string[] | null = null;
    if (!isAdminRole) {
        allowedUserIds = await getAccessibleUserIds(ctx.tenantId, ctx.userId);
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

    const projects = await prisma.hrProject.findMany({
        where: { tenantId: ctx.tenantId }
    });
    const projMap = new Map(projects.map((p: any) => [p.id, p]));

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

    if (format === 'csv') {
        const Papa = require('papaparse');
        const csvString = Papa.unparse(rawData);
        return new NextResponse(csvString, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="timesheet-export-${new Date().toISOString().split('T')[0]}.csv"`,
                'Content-Type': 'text/csv',
            }
        });
    }

    if (format === 'pdf') {
        const MyDocument = (
            <Document>
                <Page size="A4" style={styles.page}>
                    <Text style={styles.title}>Timesheet Export</Text>
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

    if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const wsRaw = XLSX.utils.json_to_sheet(rawData);
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
