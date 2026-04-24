/**
 * POST /api/tenant/expenses/approve
 *
 * Expense ticket approval workflow — Enterprise tier only.
 * Allows managers to approve/reject expense tickets submitted by employees.
 *
 * Body: { pageId: string, action: 'approve' | 'reject', note?: string }
 *
 * SCAFFOLD — full workflow to be built in Q4.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_OWNER_ROLES } from '@/lib/roles';

const MANAGER_ROLES = [...WORKSPACE_OWNER_ROLES, 'TENANT_ENTERPRISE_MANAGER'] as const;

export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = session?.user as unknown as { id?: string; tenantId?: string; role?: string };
        if (!user?.tenantId || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Enterprise only
        const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { planType: true },
        });
        if (!tenant || !['ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(tenant.planType)) {
            return NextResponse.json({
                error: 'ENTERPRISE_ONLY',
                message: 'Expense approval workflow is available on Enterprise plans.',
            }, { status: 403 });
        }

        // Only managers can approve/reject
        if (!MANAGER_ROLES.includes(user.role as typeof MANAGER_ROLES[number])) {
            return NextResponse.json({
                error: 'MANAGER_REQUIRED',
                message: 'Only managers can approve or reject expense tickets.',
            }, { status: 403 });
        }

        const body = await req.json();
        const { pageId, action, note } = body as {
            pageId: string;
            action: 'approve' | 'reject';
            note?: string;
        };

        if (!pageId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'pageId and action (approve/reject) required' }, { status: 400 });
        }

        // TODO Q4: Full approval workflow
        // - Update page status to 'opt-approved' or 'opt-rejected'
        // - Record approval metadata (who, when, note)
        // - Notify the submitter
        // - Audit trail

        console.log(`[Expense Approval] ${action} on ${pageId} by ${user.id} — note: ${note || 'none'}`);

        return NextResponse.json({
            success: true,
            action,
            pageId,
            message: `Scaffold: expense ${action} recorded. Full workflow shipping Q4.`,
        });
    } catch (error: unknown) {
        console.error('[Expense Approval] error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
