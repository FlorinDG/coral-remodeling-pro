import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { scopeFromSession } from '@/lib/data/scope';

export async function GET(req: NextRequest) {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.tenantId;
    const db = await scopeFromSession();

    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId');
    const entityType = url.searchParams.get('entityType');

    if (!entityId || !entityType) {
        return NextResponse.json({ error: 'Missing entityId or entityType' }, { status: 400 });
    }

    try {
        const logs = await db.auditLog.findMany({
            where: {
                tenantId: tenantId,
                entityId,
                entityType,
            },
            orderBy: {
                createdAt: 'desc',
            }
        });

        return NextResponse.json(logs);
    } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
