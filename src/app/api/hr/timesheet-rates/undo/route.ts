import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

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
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
