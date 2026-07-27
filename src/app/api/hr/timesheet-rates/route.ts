import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getAccessibleUserIds } from '@/app/api/hr/lib/team-scoping';

async function getContext() {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) return null;
    return {
        userId: user.id || '',
        tenantId: user.tenantId,
        role: user.role || 'USER',
    };
}

export async function POST(req: Request) {
    const ctx = await getContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdminRole = ['TENANT_ADMIN', 'SUPERADMIN', 'ACCOUNTANT', 'APP_MANAGER', 'TENANT_OWNER', 'TENANT_PRO_OWNER', 'TENANT_ENTERPRISE_OWNER'].includes(ctx.role);
    if (!isAdminRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const body = await req.json();
        const { targetWorkerId, scope, newRate, referenceEntryId } = body;
        
        if (!targetWorkerId || !scope || typeof newRate !== 'number') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let where: any = {
            tenantId: ctx.tenantId,
            userId: targetWorkerId,
            accountantExportedAt: null // Safety guard: never touch exported entries
        };

        if (scope === 'THIS_ENTRY') {
            if (!referenceEntryId) return NextResponse.json({ error: 'referenceEntryId required for THIS_ENTRY scope' }, { status: 400 });
            where.id = referenceEntryId;
        } else if (scope === 'FUTURE' || scope === 'PAST') {
            if (!referenceEntryId) return NextResponse.json({ error: 'referenceEntryId required for FUTURE/PAST scope' }, { status: 400 });
            const refEntry = await prisma.clockEntry.findUnique({ where: { id: referenceEntryId } });
            if (!refEntry) return NextResponse.json({ error: 'Reference entry not found' }, { status: 404 });
            
            if (scope === 'FUTURE') {
                where.clockInTime = { gte: refEntry.clockInTime };
            } else {
                // PAST is strictly before the reference entry's time
                where.clockInTime = { lt: refEntry.clockInTime };
            }
        } else if (scope === 'ALL') {
            // where is already scoped to worker and tenant
        } else {
            return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
        }

        // 1. Fetch entries to be modified to create a snapshot
        const entriesToModify = await prisma.clockEntry.findMany({
            where,
            select: { id: true, costRateApplied: true }
        });

        if (entriesToModify.length === 0) {
            return NextResponse.json({ message: 'No entries affected', count: 0 });
        }

        const snapshot = entriesToModify.map(e => ({
            entryId: e.id,
            oldRate: e.costRateApplied
        }));

        // Use a transaction to ensure audit and update happen together
        const result = await prisma.$transaction(async (tx) => {
            const audit = await tx.rateChangeAudit.create({
                data: {
                    tenantId: ctx.tenantId,
                    actedBy: ctx.userId,
                    targetWorkerId,
                    scope,
                    oldRate: snapshot[0]?.oldRate || 0, // Approx for UI, true values in snapshot
                    newRate,
                    affectedCount: entriesToModify.length,
                    snapshot: snapshot
                }
            });

            await tx.clockEntry.updateMany({
                where,
                data: { costRateApplied: newRate }
            });

            // Also update the employee's default rate going forward if scope is FUTURE or ALL
            if (scope === 'FUTURE' || scope === 'ALL') {
                await tx.employee.updateMany({
                    where: { userId: targetWorkerId, tenantId: ctx.tenantId },
                    data: { hourlyCost: newRate }
                });
            }

            return audit;
        });

        return NextResponse.json({ 
            success: true, 
            count: entriesToModify.length,
            auditId: result.id
        });

    } catch (err: any) {
        console.error('Rate restamp error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
