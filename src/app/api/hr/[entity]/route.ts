/**
 * HR / WorkHub API — Unified CRUD
 *
 * GET    /api/hr/[entity]          → list records
 * POST   /api/hr/[entity]          → create record
 * PATCH  /api/hr/[entity]?id=X     → update record
 * DELETE /api/hr/[entity]?id=X     → delete record
 *
 * Entities: clock-entries, shifts, shift-templates, teams, team-members,
 *           time-off, worker-schedules, projects
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// Map URL entity slugs → Prisma model names
const ENTITY_MAP: Record<string, string> = {
    'clock-entries':    'clockEntry',
    'shifts':           'scheduledShift',
    'shift-templates':  'shiftTemplate',
    'teams':            'hrTeam',
    'team-members':     'hrTeamMember',
    'time-off':         'timeOffRequest',
    'worker-schedules': 'workerSchedule',
    'projects':         'hrProject',
    'employees':        'employee',
    'shift-tasks':      'shiftTask',
    'shift-attachments': 'shiftAttachment',
};

// Fields that should NOT be overwritten by client
const PROTECTED_FIELDS = ['id', 'tenantId', 'tenant', 'createdAt', 'updatedAt'];

async function getTenantAndUser() {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) return null;
    return { userId: user.id || '', tenantId: user.tenantId, role: user.role || '' };
}

function getModel(entity: string) {
    const modelName = ENTITY_MAP[entity];
    if (!modelName) return null;
    return (prisma as any)[modelName];
}

function sanitize(data: Record<string, any>) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
        if (!PROTECTED_FIELDS.includes(k)) clean[k] = v;
    }
    return clean;
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ entity: string }> }
) {
    const ctx = await getTenantAndUser();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity } = await params;
    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const url = new URL(_req.url);
    const userId = url.searchParams.get('userId');

    // team-members don't have tenantId, they're scoped via team
    const where: Record<string, any> = entity === 'team-members'
        ? {}
        : { tenantId: ctx.tenantId };

    if (userId) where.userId = userId;

    // For team-members, scope by teamId from query
    if (entity === 'team-members') {
        const teamId = url.searchParams.get('teamId');
        if (teamId) where.teamId = teamId;
    }

    // ── VIRTUAL ENTITIES: ERP Projects & Tasks ───────────────────────────
    if (entity === 'erp-projects' || entity === 'erp-tasks') {
        try {
            const dbId = entity === 'erp-projects' ? 'db-projects' : 'db-tasks';
            const records = await prisma.globalPage.findMany({
                where: { databaseId: dbId, database: { tenantId: ctx.tenantId } },
                orderBy: { createdAt: 'desc' },
            });
            // Map GlobalPage to a simpler structure for the scheduler
            return NextResponse.json(records.map(p => ({
                id: p.id,
                name: (p.properties as any)?.title || 'Untitled',
                properties: p.properties,
                createdAt: p.createdAt,
            })));
        } catch (error: any) {
            console.error(`[HR API] GET ${entity} error:`, error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    try {
        const records = await model.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(records);
    } catch (error: any) {
        console.error(`[HR API] GET ${entity} error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(
    req: Request,
    { params }: { params: Promise<{ entity: string }> }
) {
    const ctx = await getTenantAndUser();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity } = await params;
    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const body = await req.json();
    const data = sanitize(body);

    // Auto-inject tenantId (except team-members which are scoped via team)
    if (entity !== 'team-members') {
        data.tenantId = ctx.tenantId;
    }

    // Auto-inject userId if not provided
    if (!data.userId && entity !== 'team-members') {
        data.userId = ctx.userId;
    }

    try {
        const record = await model.create({ data });

        // ── POST Automations ───────────────────────────────────────────
        // Clock-in with shiftId → set shift status to 'in-progress'
        if (entity === 'clock-entries' && record.shiftId) {
            try {
                await prisma.scheduledShift.update({
                    where: { id: record.shiftId },
                    data: { status: 'in-progress' },
                });
            } catch { /* shift may not exist */ }
        }

        return NextResponse.json(record, { status: 201 });
    } catch (error: any) {
        console.error(`[HR API] POST ${entity} error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ entity: string }> }
) {
    const ctx = await getTenantAndUser();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity } = await params;
    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Verify tenant ownership before mutation
    try {
        if (entity === 'team-members') {
            // team-members don't have tenantId — verify via parent team
            const member = await (prisma as any).hrTeamMember.findUnique({ where: { id }, include: { team: { select: { tenantId: true } } } });
            if (!member || member.team?.tenantId !== ctx.tenantId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        } else {
            const existing = await model.findFirst({ where: { id, tenantId: ctx.tenantId } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = sanitize(body);

    try {
        const record = await model.update({ where: { id }, data });

        // ── PATCH Automations ──────────────────────────────────────────
        // Clock-out (clockOutTime set) → set shift status to 'completed'
        if (entity === 'clock-entries' && data.clockOutTime && record.shiftId) {
            try {
                await prisma.scheduledShift.update({
                    where: { id: record.shiftId },
                    data: { status: 'completed' },
                });
            } catch { /* shift may not exist */ }
        }

        // Shift task completed → check if all sibling tasks are done
        if (entity === 'shift-tasks' && data.status === 'completed') {
            try {
                const allTasks = await prisma.shiftTask.findMany({
                    where: { shiftId: record.shiftId },
                });
                const allDone = allTasks.every(t => t.status === 'completed');
                if (allDone && allTasks.length > 0) {
                    await prisma.scheduledShift.update({
                        where: { id: record.shiftId },
                        data: { status: 'completed' },
                    });
                }
            } catch { /* silent */ }
        }

        return NextResponse.json(record);
    } catch (error: any) {
        console.error(`[HR API] PATCH ${entity} error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── DELETE ─────────────────────────────────────────────────────────────────
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ entity: string }> }
) {
    const ctx = await getTenantAndUser();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity } = await params;
    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Verify tenant ownership before deletion
    try {
        if (entity === 'team-members') {
            const member = await (prisma as any).hrTeamMember.findUnique({ where: { id }, include: { team: { select: { tenantId: true } } } });
            if (!member || member.team?.tenantId !== ctx.tenantId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        } else {
            const existing = await model.findFirst({ where: { id, tenantId: ctx.tenantId } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        await model.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`[HR API] DELETE ${entity} error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
