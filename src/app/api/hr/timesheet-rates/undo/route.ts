import { NextResponse } from 'next/server';
import { isTenantHrRole } from '@/app/api/hr/lib/actor-reach';
import { auth } from '@/auth';
import { scopeFromSession } from '@/lib/data/scope';
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

export function groupSnapshotByRate(
    snapshot: Array<{ entryId: string; oldRate: number | null }>
): Map<number | null, string[]> {
    const rateGroups = new Map<number | null, string[]>();
    for (const item of snapshot) {
        const existing = rateGroups.get(item.oldRate);
        if (existing) {
            existing.push(item.entryId);
        } else {
            rateGroups.set(item.oldRate, [item.entryId]);
        }
    }
    return rateGroups;
}

export async function POST(req: Request) {
    const ctx = await getContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Gate 2 — restamping cost rates is an HR act (actor-reach.ts).
    if (!isTenantHrRole(ctx.role)) return NextResponse.json({ error: 'requires_hr_role' }, { status: 403 });
    const db = await scopeFromSession();

    try {
        const body = await req.json();
        const { auditId } = body;
        
        if (!auditId) {
            return NextResponse.json({ error: 'Missing required field: auditId' }, { status: 400 });
        }

        const audit = await db.rateChangeAudit.findFirst({
            where: { id: auditId, tenantId: ctx.tenantId }
        });

        if (!audit) return NextResponse.json({ error: 'Audit record not found' }, { status: 404 });
        if (audit.revertedAt) return NextResponse.json({ error: 'Already reverted' }, { status: 400 });

        const snapshot = audit.snapshot as { entryId: string, oldRate: number | null }[];
        if (!Array.isArray(snapshot)) return NextResponse.json({ error: 'Invalid snapshot format' }, { status: 500 });

        // B8 · Group snapshot by distinct oldRate so large undos run in a few bulk updateMany calls
        const rateGroups = groupSnapshotByRate(snapshot);

        // B3 · Interactive transaction form ensures audit and update happen together under scoped client
        await db.$transaction(async (tx) => {
            for (const [oldRate, entryIds] of rateGroups) {
                await tx.clockEntry.updateMany({
                    where: { 
                        id: { in: entryIds }, 
                        tenantId: ctx.tenantId,
                        accountantExportedAt: null // Never undo an exported entry
                    },
                    data: { costRateApplied: oldRate }
                });
            }

            await tx.rateChangeAudit.update({
                where: { id: audit.id },
                data: { revertedAt: new Date() } 
            });
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Rates reverted successfully'
        });

    } catch (err: any) {
        console.error('Rate undo error:', err);
        return NextResponse.json({ error: `Server error — ${describeError(err)}` }, { status: 500 });
    }
}
