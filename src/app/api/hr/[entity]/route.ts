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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any)[modelName];
}

function sanitize(data: Record<string, unknown>) {
    const clean: Record<string, unknown> = {};
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
    if (!model && entity !== 'erp-projects' && entity !== 'erp-tasks') {
        return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });
    }

    const url = new URL(_req.url);
    const userId = url.searchParams.get('userId');

    // team-members, shift-tasks, shift-attachments don't have tenantId — they're scoped via parent
    const noTenantEntities = ['team-members', 'shift-tasks', 'shift-attachments'];
    const where: Record<string, unknown> = noTenantEntities.includes(entity)
        ? {}
        : { tenantId: ctx.tenantId };

    if (userId) where.userId = userId;

    // For shift-tasks and shift-attachments, scope by shiftId from query
    if (entity === 'shift-tasks' || entity === 'shift-attachments') {
        const shiftId = url.searchParams.get('shiftId');
        if (shiftId) where.shiftId = shiftId;
    }

    // For team-members, scope by teamId from query
    if (entity === 'team-members') {
        const teamId = url.searchParams.get('teamId');
        if (teamId) where.teamId = teamId;
    }

    // ── VIRTUAL ENTITIES: ERP Projects & Tasks ───────────────────────────
    if (entity === 'erp-projects' || entity === 'erp-tasks') {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: ctx.tenantId },
                select: { lockedDbIds: true }
            });
            const locked = (tenant?.lockedDbIds as Record<string, string>) || {};

            if (entity === 'erp-projects') {
                const projectDbId = locked['projects'] || 'db-1';

                // Fetch from GlobalPage (Dynamic DB)
                const dynamicProjects = await prisma.globalPage.findMany({
                    where: { databaseId: projectDbId, database: { tenantId: ctx.tenantId } },
                    select: { id: true, properties: true, createdAt: true }
                });

                // Fetch from InternalProject (Specialized Model)
                const internalProjects = await prisma.internalProject.findMany({
                    where: { tenantId: ctx.tenantId },
                    select: { id: true, name: true, projectCode: true, createdAt: true }
                });

                // Merge
                const merged = [
                    ...dynamicProjects.map(p => {
                        const props = p.properties as Record<string, unknown>;
                        return {
                            id: p.id,
                            name: String(props?.title || props?.name || 'Untitled'),
                            source: 'dynamic',
                            createdAt: p.createdAt,
                        };
                    }),
                    ...internalProjects.map(p => ({
                        id: p.id,
                        name: `${p.projectCode}: ${p.name}`,
                        source: 'internal',
                        createdAt: p.createdAt,
                    }))
                ];

                return NextResponse.json(merged);
            }

            if (entity === 'erp-tasks') {
                const tasksDbId = locked['tasks'] || 'db-tasks';

                // Scope filter: admin/accountant roles see all tasks.
                // Employee/workforce role sees only tasks assigned to or created by them.
                // Mirrors the ASSIGNED_AND_OWN rule in access-control.ts.
                const isAdminRole = ['TENANT_ADMIN', 'SUPERADMIN', 'ACCOUNTANT'].includes(ctx.role);
                const pageWhere: Record<string, unknown> = {
                    databaseId: tasksDbId,
                    database: { tenantId: ctx.tenantId },
                };
                if (!isAdminRole) {
                    pageWhere.OR = [
                        { assignedTo: { has: ctx.userId } },
                        { createdBy: ctx.userId },
                    ];
                }

                const tasks = await prisma.globalPage.findMany({
                    where: pageWhere,
                    select: { id: true, properties: true, createdAt: true, assignedTo: true }
                });

                return NextResponse.json(tasks.map(t => {
                    const props = t.properties as Record<string, unknown>;
                    // prop-task-project is a relation stored as string[]
                    const projectArr = props['prop-task-project'] as string[] | undefined;
                    return {
                        id: t.id,
                        name: String(props['title'] || 'Untitled Task'),
                        // Expose full properties for client-side filtering / display
                        properties: props,
                        // Convenience scalars for the time-tracker hooks
                        projectId: Array.isArray(projectArr) ? (projectArr[0] || null) : null,
                        status: String(props['prop-task-status'] || 'opt-todo'),
                        priority: String(props['prop-task-priority'] || 'opt-low'),
                        assignedTo: t.assignedTo,
                    };
                }));
            }
        } catch (error: unknown) {
            console.error(`[HR API] GET ${entity} error:`, error);
            return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
        }
    }

    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    try {
        const records = await model.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(records);
    } catch (error: unknown) {
        console.error(`[HR API] GET ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
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

    // Auto-inject tenantId (except entities scoped via parent: team-members, shift-tasks, shift-attachments)
    const noTenantEntities = ['team-members', 'shift-tasks', 'shift-attachments'];
    if (!noTenantEntities.includes(entity)) {
        data.tenantId = ctx.tenantId;
    }

    // Auto-inject userId if not provided (only for entities that have userId)
    if (!data.userId && !noTenantEntities.includes(entity)) {
        data.userId = ctx.userId;
    }

    try {
        const record = await model.create({ data });

        // ── POST Automations ───────────────────────────────────────────
        // Clock-in with shiftId → set shift status to 'in-progress'
        if (entity === 'clock-entries' && (record as { shiftId?: string }).shiftId) {
            try {
                await prisma.scheduledShift.update({
                    where: { id: (record as { shiftId: string }).shiftId },
                    data: { status: 'in-progress' },
                });
            } catch { /* shift may not exist */ }
        }

        return NextResponse.json(record, { status: 201 });
    } catch (error: unknown) {
        console.error(`[HR API] POST ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const member = await (prisma as any).hrTeamMember.findUnique({ 
                where: { id }, 
                include: { team: { select: { tenantId: true } } } 
            });
            if (!member || member.team?.tenantId !== ctx.tenantId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        } else if (entity === 'shift-tasks' || entity === 'shift-attachments') {
            // shift-tasks/attachments don't have tenantId — verify via parent shift
            const existing = await model.findUnique({ where: { id } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            // Verify the parent shift belongs to this tenant
            if (existing.shiftId) {
                const parentShift = await prisma.scheduledShift.findFirst({
                    where: { id: existing.shiftId, tenantId: ctx.tenantId }
                });
                if (!parentShift) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        } else {
            const existing = await model.findFirst({ where: { id, tenantId: ctx.tenantId } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = sanitize(body);

    try {
        const record = await model.update({ where: { id }, data });

        // ── PATCH Automations ──────────────────────────────────────────
        // Clock-out (clockOutTime set) → set shift status to 'completed'
        if (entity === 'clock-entries' && data.clockOutTime && (record as { shiftId?: string }).shiftId) {
            try {
                await prisma.scheduledShift.update({
                    where: { id: (record as { shiftId: string }).shiftId },
                    data: { status: 'completed' },
                });
            } catch { /* shift may not exist */ }
        }

        // Shift task completed → check if all sibling tasks are done
        if (entity === 'shift-tasks' && data.status === 'completed' && (record as { shiftId?: string }).shiftId) {
            try {
                const shiftId = (record as { shiftId: string }).shiftId;
                const allTasks = await prisma.shiftTask.findMany({
                    where: { shiftId },
                });
                const allDone = allTasks.every(t => t.status === 'completed');
                if (allDone && allTasks.length > 0) {
                    await prisma.scheduledShift.update({
                        where: { id: shiftId },
                        data: { status: 'completed' },
                    });
                }
            } catch { /* silent */ }
        }

        return NextResponse.json(record);
    } catch (error: unknown) {
        console.error(`[HR API] PATCH ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const member = await (prisma as any).hrTeamMember.findUnique({ 
                where: { id }, 
                include: { team: { select: { tenantId: true } } } 
            });
            if (!member || member.team?.tenantId !== ctx.tenantId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        } else if (entity === 'shift-tasks' || entity === 'shift-attachments') {
            // Verify via parent shift
            const existing = await model.findUnique({ where: { id } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            if (existing.shiftId) {
                const parentShift = await prisma.scheduledShift.findFirst({
                    where: { id: existing.shiftId, tenantId: ctx.tenantId }
                });
                if (!parentShift) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        } else {
            const existing = await model.findFirst({ where: { id, tenantId: ctx.tenantId } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        await model.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error(`[HR API] DELETE ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
