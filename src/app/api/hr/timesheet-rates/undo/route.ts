import { NextResponse } from 'next/server';
import { isTenantHrRole } from '@/app/api/hr/lib/actor-reach';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { describeError } from '@/lib/describe-error';

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

    // Gate 2 — restamping cost rates is an HR act (actor-reach.ts).
    if (!isTenantHrRole(ctx.role)) return NextResponse.json({ error: 'requires_hr_role' }, { status: 403 });

    try {
        const body = await req.json();
        const { auditId } = body;
        
        if (!auditId) {
            return NextResponse.json({ error: 'Missing required field: auditId' }, { status: 400 });
        }

        const audit = await prisma.rateChangeAudit.findUnique({
            where: { id: auditId, tenantId: ctx.tenantId }
        });

        if (!audit) return NextResponse.json({ error: 'Audit record not found' }, { status: 404 });
        if (audit.revertedAt) return NextResponse.json({ error: 'Already reverted' }, { status: 400 });

        const snapshot = audit.snapshot as { entryId: string, oldRate: number | null }[];
        if (!Array.isArray(snapshot)) return NextResponse.json({ error: 'Invalid snapshot format' }, { status: 500 });

        // Build individual update promises (since each entry had a distinct old rate, bulk updateMany won't work perfectly unless grouped)
        // For simplicity and correctness with varying oldRates, we update iteratively within transaction
        const updates = snapshot.map(item => 
            prisma.clockEntry.updateMany({
                where: { 
                    id: item.entryId, 
                    tenantId: ctx.tenantId,
                    accountantExportedAt: null // Never undo an exported entry
                },
                data: { costRateApplied: item.oldRate }
            })
        );

        // Also mark audit as reverted
        const revertAudit = prisma.rateChangeAudit.update({
            where: { id: audit.id },
            data: { revertedAt: new Date() } 
        });

        await prisma.$transaction([...updates, revertAudit]);

        return NextResponse.json({ 
            success: true, 
            message: 'Rates reverted successfully'
        });

    } catch (err: any) {
        console.error('Rate undo error:', err);
        return NextResponse.json({ error: `Server error — ${describeError(err)}` }, { status: 500 });
    }
}
