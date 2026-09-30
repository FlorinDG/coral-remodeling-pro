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
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import { resolveReach } from '../lib/actor-reach';
import { hrWriteRefusal } from '../lib/write-policy';
import { describeError } from '@/lib/describe-error';
import { isShiftSubmitted, zonedParts } from '@/lib/kernel/shift-time';
import { resolveProjects, projectNameMap } from '@/lib/data/projects';
import crypto from 'crypto';
import { Resend } from 'resend';
import React from 'react';
import InvitationEmail from '@/emails/InvitationEmail';
import { syncSeatQuantities } from '@/lib/stripe';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

// Map URL entity slugs → Prisma model names
const ENTITY_MAP: Record<string, string> = {
    'clock-entries':    'clockEntry',
    'shifts':           'scheduledShift',
    'scheduled-shifts': 'scheduledShift',
    'shift-templates':  'shiftTemplate',
    'teams':            'hrTeam',
    'team-members':     'hrTeamMember',
    'time-off':         'timeOffRequest',
    'worker-schedules': 'workerSchedule',
    'projects':         'hrProject',
    'employees':        'employee',
    // 'employees' now handled by standard Prisma Employee model
    'shift-tasks':      'shiftTask',
    'shift-attachments': 'shiftAttachment',
    'approval-requests': 'hrApprovalRequest',
    'support-messages':  'hrSupportMessage',
    'audit-logs':        'auditLog',
};

// Roles that count as "employees" in HR context (queryable via /api/hr/employees)
const HR_EMPLOYEE_ROLES = [
    'SUPERADMIN',
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'EMPLOYEE',
    'ACCOUNTANT',
    'TENANT_PRO_EMPLOYEE',
    'TENANT_ENTERPRISE_EMPLOYEE',
    'TENANT_ENTERPRISE_WORKFORCE',
    'TENANT_ENTERPRISE_MANAGER',
    'BOOKKEEPING',
    'TEAMLEAD',
    'PROJECT_MANAGER',
    'HR_OFFICER',
    'OFFERTES',
];

// Fields that should NOT be overwritten by client
const PROTECTED_FIELDS = ['id', 'tenantId', 'tenant', 'createdAt', 'updatedAt', 'createdBy'];

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

/** WB-A: a shift's order giver must be a page of THIS tenant's clients database — the FK alone only
 *  proves "some page" (GlobalPage is polymorphic). null/'' clears it. Returns an error response or null. */
async function contactPageRefusal(tenantId: string, data: Record<string, unknown>): Promise<NextResponse | null> {
    if (!('contactPageId' in data)) return null;
    if (data.contactPageId === '' || data.contactPageId === null) { data.contactPageId = null; return null; }
    const page = await prisma.globalPage.findFirst({
        where: { id: String(data.contactPageId), database: { tenantId, logicalKey: 'clients' } },
        select: { id: true },
    });
    return page ? null : NextResponse.json({ error: 'contact_page_not_a_client' }, { status: 400 });
}

/** Gate 2 refusal → a named 403 (ERROR-SURFACING: the code says what was refused). */
function hrWriteGate(
    entity: string, method: 'POST' | 'PATCH' | 'DELETE', mayApprove: boolean, actorId: string,
    data: Record<string, unknown>, existing: Record<string, unknown> | null,
): NextResponse | null {
    const refusal = hrWriteRefusal(entity, method, mayApprove, actorId, data, existing);
    if (!refusal) return null;
    return NextResponse.json({ error: refusal.detail ? `${refusal.code}: ${refusal.detail}` : refusal.code }, { status: 403 });
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
    if (!model && entity !== 'erp-projects' && entity !== 'erp-tasks' && entity !== 'erp-clients') {
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

    // Gate 2 (actor reach) — asked of ONE authority, never decided here (pd.md 5a).
    const reach = await resolveReach(ctx);
    const isAdminRole = reach.kind === 'tenant';
    if ((entity === 'time-off' || entity === 'clock-entries' || entity === 'shifts') && !isAdminRole) {
        const accessibleIds = Array.from(reach.userIds ?? []);
        where.userId = { in: accessibleIds };
    }

    // For shift-tasks and shift-attachments, scope by parent shift belonging to tenant (TSC-4b structural scoping)
    if (entity === 'shift-tasks' || entity === 'shift-attachments') {
        where.shift = { tenantId: ctx.tenantId };
        const shiftId = url.searchParams.get('shiftId');
        if (shiftId) where.shiftId = shiftId;
    }

    // For team-members, scope by teamId from query, and ALWAYS scope by tenant
    if (entity === 'team-members') {
        const teamId = url.searchParams.get('teamId');
        if (teamId) {
            where.teamId = teamId;
            where.team = { tenantId: ctx.tenantId };
        } else {
            where.team = { tenantId: ctx.tenantId };
        }
    }

    // For audit-logs, scope by entityId and entityType if provided
    if (entity === 'audit-logs') {
        const entityId = url.searchParams.get('entityId');
        if (entityId) where.entityId = entityId;
        const entityType = url.searchParams.get('entityType');
        if (entityType) where.entityType = entityType;
    }

    // ── VIRTUAL ENTITY: ERP Clients (WB-A — the order giver picker in the shift form) ──
    // Pages of the tenant's CLIENTS system database (binding read via logicalKey, never parsed).
    // Planning is an HR act: only tenant HR roles list clients here.
    if (entity === 'erp-clients') {
        if (!reach.mayApprove) return NextResponse.json([]);
        try {
            const pages = await prisma.globalPage.findMany({
                where: { database: { tenantId: ctx.tenantId, logicalKey: 'clients' } },
                select: { id: true, properties: true },
            });
            return NextResponse.json(pages.map(p => {
                const props = (p.properties || {}) as Record<string, unknown>;
                const name = String(props.title || props.company || '').trim() || '—';
                const company = String(props.company || '').trim();
                return {
                    id: p.id,
                    name: company && company !== name ? `${name} · ${company}` : name,
                    email: String(props.email || '').trim() || null,
                };
            }).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error: unknown) {
            console.error('[HR API] GET erp-clients error:', error);
            return NextResponse.json({ error: `erp-clients — ${describeError(error)}` }, { status: 500 });
        }
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
                // PROJ-SSOT-1: the ONE resolver (lib/data/projects.ts). The non-admin filter stays
                // HERE, with the caller's reach — the resolver never widens or narrows on its own.
                let onlyIds: string[] | undefined;
                if (!isAdminRole) {
                    const accessibleIds = Array.from(reach.userIds ?? []);
                    const shifts = await prisma.scheduledShift.findMany({
                        where: { userId: { in: accessibleIds }, tenantId: ctx.tenantId },
                        select: { projectId: true }
                    });
                    onlyIds = Array.from(new Set(shifts.map(s => s.projectId).filter(Boolean))) as string[];
                }
                const projects = await resolveProjects(ctx.tenantId, onlyIds ? { onlyIds } : undefined);
                return NextResponse.json(projects);
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
                    const { getAccessibleUserIds } = await import('../lib/team-scoping');
                    const accessibleIds = await getAccessibleUserIds(ctx.tenantId, ctx.userId);
                    pageWhere.OR = [
                        { assignedTo: { hasSome: accessibleIds } },
                        { createdBy: { in: accessibleIds } },
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
        let records = await model.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        if (entity === 'shifts') {
            const timeOffWhere = { ...where, status: 'approved' };
            const approvedTimeOff = await prisma.timeOffRequest.findMany({
                where: timeOffWhere,
                orderBy: { createdAt: 'desc' },
            });
            
            const shadowShifts: any[] = [];
            for (const t of approvedTimeOff) {
                if (!t.userId || !t.startDate || !t.endDate) continue;
                try {
                    const start = new Date(t.startDate);
                    const end = new Date(t.endDate);
                    
                    let days = 0;
                    for (let d = new Date(start); d <= end && days <= 365; d.setDate(d.getDate() + 1), days++) {
                        const shiftDate = d.toISOString().split('T')[0];
                        shadowShifts.push({
                            id: `leave-${t.id}-${shiftDate}`,
                            userId: t.userId,
                            shiftDate: shiftDate,
                            shiftStart: '08:00',
                            shiftEnd: '17:00',
                            shiftName: t.requestType || 'Leave',
                            projectId: null,
                            role: null,
                            notes: t.notes || null,
                            status: 'leave',
                            createdBy: 'system',
                            lastEditedBy: 'system',
                            createdAt: t.createdAt,
                            updatedAt: t.updatedAt,
                            isSynthetic: true,
                            sourceType: 'timeoff',
                            sourceId: t.id
                        });
                    }
                } catch (e) {}
            }
            records = [...records, ...shadowShifts];
        }

        // Enrich user names for clock-entries, time-off, and shifts
        if (entity === 'clock-entries' || entity === 'time-off' || entity === 'shifts') {
            const userIds = [...new Set(records.map((r: any) => r.userId).filter(Boolean))] as string[];
            if (userIds.length > 0) {
                const users = await prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, name: true, email: true }
                });
                const employees = await prisma.employee.findMany({
                    where: { userId: { in: userIds } },
                    select: { userId: true, firstName: true, lastName: true }
                });
                
                const userMap = new Map(users.map(u => [u.id, u]));
                const empMap = new Map(employees.map(e => [e.userId, e]));
                
                // Fallback: some legacy rows may hold Employee.id instead of User.id
                // Build a second lookup for those cases
                const unresolvedIds = userIds.filter(id => !userMap.has(id) && !empMap.has(id));
                const legacyEmpMap = new Map<string, { firstName: string; lastName: string }>();
                if (unresolvedIds.length > 0) {
                    const legacyEmployees = await prisma.employee.findMany({
                        where: { id: { in: unresolvedIds } },
                        select: { id: true, firstName: true, lastName: true }
                    });
                    legacyEmployees.forEach(e => legacyEmpMap.set(e.id, e));
                }
                
                records = records.map((r: any) => {
                    const u = userMap.get(r.userId);
                    const e = empMap.get(r.userId);
                    const legacy = legacyEmpMap.get(r.userId);
                    let userName = r.userId?.slice(0, 8) || 'System';
                    if (u?.name) userName = u.name;
                    else if (e?.firstName || e?.lastName) userName = `${e.firstName || ''} ${e.lastName || ''}`.trim();
                    else if (legacy) userName = `${legacy.firstName || ''} ${legacy.lastName || ''}`.trim();
                    else if (u?.email) userName = u.email;
                    
                    return { ...r, userName };
                });
            }
            
            // SCH-7: Project name enrichment for shifts
            if (entity === 'shifts') {
                const projectIds = [...new Set(records.map((r: any) => r.projectId).filter(Boolean))] as string[];
                if (projectIds.length > 0) {
                    // PROJ-SSOT-1: names from the one resolver (was HrProject — empty, and unscoped by tenant).
                    const projectMap = await projectNameMap(ctx.tenantId, projectIds);
                    records = records.map((r: any) => ({
                        ...r,
                        projectName: r.projectId ? projectMap.get(r.projectId) : undefined,
                    }));
                }
            }

            // WORKHUB-CLOCKLINK: Enrich clock entries for shifts
            if (entity === 'shifts') {
                const shiftIds = records.map((r: any) => r.id).filter((id: string) => id && !id.startsWith('leave-'));
                if (shiftIds.length > 0) {
                    const entries = await prisma.clockEntry.findMany({
                        where: { shiftId: { in: shiftIds } },
                        orderBy: { clockInTime: 'asc' },
                    });
                    const entriesByShift = new Map<string, any[]>();
                    entries.forEach(e => {
                        if (e.shiftId) {
                            const list = entriesByShift.get(e.shiftId) || [];
                            list.push(e);
                            entriesByShift.set(e.shiftId, list);
                        }
                    });
                    records = records.map((r: any) => ({
                        ...r,
                        clockEntries: entriesByShift.get(r.id) || [],
                    }));
                } else {
                    records = records.map((r: any) => ({ ...r, clockEntries: [] }));
                }
            }
        }
        
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

    if (entity === 'audit-logs') {
        return NextResponse.json({ error: 'Audit logs are immutable' }, { status: 403 });
    }

    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const body = await req.json();
    const data = sanitize(body);
    const warnings: string[] = [];

    // Auto-inject tenantId (except entities scoped via parent: team-members, shift-tasks, shift-attachments)
    const noTenantEntities = ['team-members', 'shift-tasks', 'shift-attachments'];
    if (!noTenantEntities.includes(entity)) {
        data.tenantId = ctx.tenantId;
    }

    // For shift-tasks and shift-attachments, verify parent shift belongs to tenant before creating (TSC-4b)
    if (entity === 'shift-tasks' || entity === 'shift-attachments') {
        const shiftId = data.shiftId as string | undefined;
        if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 });
        // TODO(R1-4): Class-B parent check — TenantScopedClient makes this automatic (TSC-0 D7). Delete this block when R1-4 lands.
        const parent = await prisma.scheduledShift.findFirst({
            where: { id: shiftId, tenantId: ctx.tenantId },
            select: { id: true },
        });
        if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Auto-inject userId if not provided (only for entities that have userId)
    const entitiesWithUserId = ['clock-entries', 'shifts', 'scheduled-shifts', 'shift-templates', 'worker-schedules', 'time-off'];
    if (!data.userId && entitiesWithUserId.includes(entity)) {
        data.userId = ctx.userId;
    }

    // ── GATE 2 · WRITE POLICY (POST) — coral-walkdown-actor-reach-writes.md ──────
    // Only tenant HR roles (tenant admin · director · HR) write the back office or approve.
    // Everyone else gets named self-service: their OWN clock entries, leave and requests, all pending.
    const writeReach = await resolveReach(ctx);
    const gate2 = hrWriteGate(entity, 'POST', writeReach.mayApprove, ctx.userId, data, null);
    if (gate2) return gate2;
    if (entity === 'shifts') {
        const bad = await contactPageRefusal(ctx.tenantId, data);
        if (bad) return bad;
    }
    if (entity === 'clock-entries') {
        // Facts the server records about an act — never values a client supplies (any role).
        delete data.approvedBy;
        delete data.approvedAt;
        delete data.editedAfterApproval;
        delete data.costRateApplied;
        // CE-TIME-1: a LIVE clock-in (no clockOutTime) happens NOW — the server's clock, not the phone's.
        // Closed records (late entries, manual entries) carry typed times and are pending / HR-made.
        // When the offline queue lands (kernel), the queued intent's time comes from it, not from here.
        if (!data.clockOutTime) {
            data.clockInTime = new Date();
        }
    }

    // For clock-entries, stamp createdBy server-side from authenticated ctx.userId (HR-TS-7)
    if (entity === 'clock-entries') {
        data.createdBy = ctx.userId;
        if (data.approvalStatus === 'approved') {
            data.approvedBy = ctx.userId;
            data.approvedAt = new Date();
        }
    }

    // SCH-1: Reroute shift creations with status 'leave' to TimeOffRequest
    if (entity === 'shifts' && data.status === 'leave') {
        try {
            // Gate 2: 'admin'/'owner' matched no real role, so every admin-created leave landed pending.
            const isAdminRole = (await resolveReach(ctx)).mayApprove;
            const leaveBody = {
                tenantId: ctx.tenantId,
                userId: data.userId as string,
                requestType: (data.shiftName as string) || 'vacation',
                startDate: data.shiftDate as string,
                endDate: data.shiftDate as string,
                status: isAdminRole ? 'approved' : 'pending',
                notes: data.notes as string | undefined
            };
            const t = await prisma.timeOffRequest.create({ data: leaveBody });
            const synthetic = {
                id: `leave-${t.id}-${t.startDate}`,
                userId: t.userId,
                shiftDate: t.startDate,
                shiftStart: '08:00',
                shiftEnd: '17:00',
                shiftName: t.requestType,
                projectId: null,
                role: null,
                notes: t.notes || null,
                status: 'leave',
                isSynthetic: true,
                sourceType: 'timeoff',
                sourceId: t.id,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
            };
            return NextResponse.json(synthetic, { status: 201 });
        } catch (error: unknown) {
            console.error(`[HR API] POST shifts (leave reroute) error:`, error);
            return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
        }
    }

    // ── PRE-CREATE Automations ───────────────────────────────────────
    let parentShift: { id: string; projectId: string | null; status?: string } | null = null;
    if (entity === 'clock-entries') {
        // Seraph (checklist item 8): the worker an entry is FOR must be a user of THIS tenant.
        // ClockEntry.userId has no FK; without this a foreign user's id was accepted as-is.
        const subject = await prisma.user.findFirst({
            where: { id: data.userId as string, tenantId: ctx.tenantId },
            select: { id: true },
        });
        if (!subject) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // WHS-1b: one OPEN entry per worker. A client that could not load its own state
        // (slow network, failed GET) may still offer "clock in" — the server is the authority.
        // Closed records (manual / late entries carry a clockOutTime) are never refused.
        // Read-then-refuse; the durable form is a partial unique index (Florin decision).
        if (!data.clockOutTime) {
            try {
                const open = await prisma.clockEntry.findFirst({
                    where: { tenantId: ctx.tenantId, userId: data.userId as string, clockOutTime: null },
                    orderBy: { clockInTime: 'desc' },
                });
                if (open) {
                    return NextResponse.json({ error: 'already_clocked_in', entry: open }, { status: 409 });
                }
            } catch (err) {
                console.error('[HR API] POST clock-entries: open-entry check failed:', err);
                return NextResponse.json(
                    { error: `open_entry_check_failed: ${err instanceof Error ? err.message : String(err)}` },
                    { status: 503 }
                );
            }
        }

        // TS-8: Stamp hourly cost from Employee profile at time of creation
        try {
            const employee = await prisma.employee.findFirst({
                where: { userId: data.userId as string, tenantId: ctx.tenantId },
                select: { hourlyCost: true }
            });
            if (employee?.hourlyCost !== undefined && employee?.hourlyCost !== null) {
                data.costRateApplied = employee.hourlyCost;
            }
        } catch (err) {
            console.error('Failed to stamp hourly cost:', err);
            warnings.push('hourly_cost_not_stamped');
        }

        // HRA-1: Resolve parent shift within tenant (replaces unverified findUnique)
        if (data.shiftId) {
            try {
                // TODO(R1-4): Class-B parent check — TenantScopedClient makes this automatic (TSC-0 D7). Delete this block when R1-4 lands.
                parentShift = await prisma.scheduledShift.findFirst({
                    where: { id: data.shiftId as string, tenantId: ctx.tenantId },
                    select: { id: true, projectId: true, status: true },
                });
                // A SUBMITTED shift is closed: the crew member attested it complete.
                if (parentShift && isShiftSubmitted(parentShift.status) && !writeReach.mayApprove) {
                    return NextResponse.json({ error: 'shift_submitted' }, { status: 409 });
                }
                if (!parentShift) {
                    // 🔴 NOT a 404. The entry is real work and is always recorded.
                    warnings.push('shift_not_found');   // surfaced on the response
                    delete data.shiftId;                // no linkage, no automation, no leak
                }
            } catch (err) {
                console.error('[HR API] Failed to resolve parent shift:', err);
                warnings.push('shift_lookup_failed');
                delete data.shiftId;
            }
        }

        // TS-3 / HRA-1: Inherit projectId from parentShift if not already set
        if (parentShift?.projectId && !data.projectId) {
            data.projectId = parentShift.projectId;
        }
    }

    try {
        const record = await model.create({ data });

        // ── POST Automations ───────────────────────────────────────────
        // Clock-in with shiftId → set shift status to 'in-progress' (HRA-2)
        if (entity === 'clock-entries' && parentShift && (record as { shiftId?: string }).shiftId) {
            try {
                const result = await prisma.scheduledShift.updateMany({
                    where: { id: (record as { shiftId: string }).shiftId, tenantId: ctx.tenantId },
                    data: { status: 'in-progress' },
                });
                if (result.count === 0) {
                    console.error(`[HR API] POST clock-entries: shift ${(record as { shiftId: string }).shiftId} not found for tenant ${ctx.tenantId}`);
                    warnings.push('shift_status_not_updated');
                }
            } catch (err) {
                console.error('[HR API] Failed to update shift status on clock-in:', err);
                warnings.push('shift_status_not_updated');
            }
        }

        return NextResponse.json(
            warnings.length > 0 ? { ...(typeof record === 'object' && record !== null ? record : {}), warnings } : record,
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error(`[HR API] POST ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

import { cookies } from 'next/headers';

async function verifyUnlockCookie(tenantId: string, userId: string): Promise<boolean> {
    const cookieStore = await cookies();
    const token = cookieStore.get('timesheet_unlock')?.value;
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;
    
    const [payloadBase64, signature] = parts;
    const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback-secret-for-dev';
    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(Buffer.from(payloadBase64, 'base64').toString('utf-8')).digest('hex');
    
    if (signature !== expectedSignature) return false;

    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
        if (payload.tenantId !== tenantId || payload.userId !== userId) return false;
        if (Date.now() > payload.exp) return false;
        return true;
    } catch {
        return false;
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

    if (entity === 'audit-logs') {
        return NextResponse.json({ error: 'Audit logs are immutable' }, { status: 403 });
    }

    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (id.startsWith('leave-')) {
        return NextResponse.json({ error: 'Cannot mutate synthetic absence blocks directly' }, { status: 400 });
    }

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
            // shift-tasks/attachments don't have tenantId — verify via parent shift (TSC-4c: unconditional check)
            const existing = await model.findUnique({ where: { id } });
            if (!existing || !existing.shiftId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            // TODO(R1-4): Class-B parent check — TenantScopedClient makes this automatic (TSC-0 D7). Delete this block when R1-4 lands.
            const parentShift = await prisma.scheduledShift.findFirst({
                where: { id: existing.shiftId, tenantId: ctx.tenantId },
                select: { id: true },
            });
            if (!parentShift) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        } else {
            const existing = await model.findFirst({ where: { id, tenantId: ctx.tenantId } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = sanitize(body);
    const warnings: string[] = [];

    // ── GATE 2 · WRITE POLICY (PATCH) ──
    if (entity === 'shifts') {
        const bad = await contactPageRefusal(ctx.tenantId, data);
        if (bad) return bad;
    }
    const patchReach = await resolveReach(ctx);
    if (!patchReach.mayApprove) {
        const selfServiceEntity = entity === 'clock-entries' || entity === 'time-off';
        const existingRow = selfServiceEntity
            ? await model.findFirst({ where: { id, tenantId: ctx.tenantId } })
            : null;
        const gate2 = hrWriteGate(entity, 'PATCH', false, ctx.userId, data, existingRow);
        if (gate2) return gate2;
    }
    if (entity === 'clock-entries') {
        // Server-recorded facts — the approval branch below stamps approvedBy/approvedAt itself.
        delete data.approvedBy;
        delete data.approvedAt;
        delete data.costRateApplied;
        // CE-TIME-1: a crew member closing their own entry clocks out NOW (server time).
        // HR roles may set an explicit clockOutTime (force clock-out, corrections — audited below).
        if (!patchReach.mayApprove && 'clockOutTime' in data) {
            data.clockOutTime = new Date();
        }
    }

    try {
        let record;

        // --- CLOCK ENTRIES INTERCEPT: Audit and Edit Guard ---
        if (entity === 'clock-entries') {
            const existingEntry = await prisma.clockEntry.findUnique({ where: { id } });
            if (!existingEntry || existingEntry.tenantId !== ctx.tenantId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            // Edit Guard check
            if (existingEntry.approvalStatus === 'approved') {
                const isForceClockOut = !existingEntry.clockOutTime && data.clockOutTime;
                if (!isForceClockOut) {
                    const isUnlocked = await verifyUnlockCookie(ctx.tenantId, ctx.userId);
                    if (!isUnlocked) {
                        return NextResponse.json({ error: 'Editing approved entries requires unlock' }, { status: 403 });
                    }
                    data.editedAfterApproval = true;
                }
            }

            // Force source = 'Aangepast' if not just approving/unapproving (preserving admin_entry)
            const isJustApproval = Object.keys(data).every(k => ['approvalStatus', 'approvedBy', 'approvedAt', 'editedAfterApproval'].includes(k));
            if (!isJustApproval && existingEntry.source !== 'admin_entry') {
                data.source = 'Aangepast';
            }

            let auditAction = 'update';
            if (data.approvalStatus && data.approvalStatus !== existingEntry.approvalStatus) {
                auditAction = data.approvalStatus === 'approved' ? 'approve' : 'unapprove';
                if (data.approvalStatus === 'approved') {
                    data.approvedBy = ctx.userId;
                    data.approvedAt = new Date();
                } else {
                    data.approvedBy = null;
                    data.approvedAt = null;
                }
            } else if (!existingEntry.clockOutTime && data.clockOutTime) {
                auditAction = 'forceClockOut';
            }

            const auditData = await buildAuditLogData({
                tenantId: ctx.tenantId,
                userId: ctx.userId,
            }, {
                entityType: 'clockEntry',
                entityId: id,
                action: auditAction,
                before: existingEntry,
                after: { ...existingEntry, ...data, ...(data.source ? { source: data.source } : {}) },
                reason: data.editedAfterApproval ? 'edited-after-approval' : null,
            });
            const auditOp = buildAuditLogOperation(prisma, auditData);

            // Execute in transaction
            const [updated] = await prisma.$transaction([
                prisma.clockEntry.update({ where: { id }, data }),
                auditOp
            ]);
            record = updated;
        } else {
            record = await model.update({ where: { id }, data });
        }

        // ── PATCH Automations ──────────────────────────────────────────
        // Approval / rejection of clock entry requests (late_entry, manual_hours)
        if (entity === 'approval-requests' && (data.status === 'approved' || data.status === 'rejected')) {
            try {
                const approval = record as any;
                if (approval.entityType === 'clock_entry') {
                    const reqData = (approval.requestData as any) || {};
                    const existingClockEntryId = reqData.id || reqData.clockEntryId || reqData.entityId;

                    if (existingClockEntryId) {
                        // Clock entry was created at submit time (late_entry) — update approval status
                        await prisma.clockEntry.updateMany({
                            where: { id: existingClockEntryId, tenantId: ctx.tenantId },
                            data: {
                                requiresApproval: false,
                                approvalStatus: data.status,
                                approvedBy: approval.reviewedBy || ctx.userId,
                                approvedAt: approval.reviewedAt ? new Date(approval.reviewedAt) : new Date(),
                            }
                        });
                    } else if (data.status === 'approved' && approval.requestType === 'manual_hours') {
                        // Legacy manual hours without pre-existing clock entry
                        const entry = await prisma.clockEntry.create({
                            data: {
                                tenantId: approval.tenantId,
                                userId: approval.userId,
                                clockInTime: new Date(reqData.clockInTime),
                                clockOutTime: new Date(reqData.clockOutTime),
                                taskDescription: reqData.taskDescription || '',
                                requiresApproval: false,
                                approvalStatus: 'approved',
                                approvedBy: approval.reviewedBy || ctx.userId,
                                approvedAt: approval.reviewedAt ? new Date(approval.reviewedAt) : new Date(),
                                projectId: reqData.projectId || null,
                            }
                        });
                        if (reqData.projectId) {
                            // Wall-clock parts in the business zone (was UTC via toISOString — 2h early).
                            const inLocal = zonedParts(reqData.clockInTime);
                            const shiftDate = inLocal.date;
                            const shiftStart = inLocal.time;
                            const shiftEnd = zonedParts(reqData.clockOutTime).time;
                            const shift = await prisma.scheduledShift.create({
                                data: {
                                    tenantId: approval.tenantId,
                                    userId: approval.userId,
                                    projectId: reqData.projectId,
                                    shiftDate,
                                    shiftStart,
                                    shiftEnd,
                                    // not 'completed': only the crew member's submit completes a shift
                                    createdBy: approval.reviewedBy || ctx.userId,
                                }
                            });
                            await prisma.clockEntry.update({
                                where: { id: entry.id },
                                data: { shiftId: shift.id }
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to process approval request status change:", err);
            }
        }

        // HRA-3 REMOVED (Florin 2026-09-30): clock-out no longer completes the shift. A shift is
        // completed ONLY when the crew member submits it (lib/data/shift-submit.ts) — a shift can be
        // worked more than once, and submitting is the crew's accountable act.

        // (Removed 2026-09-30: finishing every shift task no longer completes the shift — only the
        //  crew member's submit does.)

        return NextResponse.json(
            warnings.length > 0 ? { ...(typeof record === 'object' && record !== null ? record : {}), warnings } : record
        );
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

    if (entity === 'audit-logs') {
        return NextResponse.json({ error: 'Audit logs are immutable' }, { status: 403 });
    }

    const model = getModel(entity);
    if (!model) return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (id.startsWith('leave-')) {
        return NextResponse.json({ error: 'Cannot delete synthetic absence blocks directly' }, { status: 400 });
    }

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
            // Verify via parent shift (TSC-4c: unconditional check)
            const existing = await model.findUnique({ where: { id } });
            if (!existing || !existing.shiftId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            // TODO(R1-4): Class-B parent check — TenantScopedClient makes this automatic (TSC-0 D7). Delete this block when R1-4 lands.
            const parentShift = await prisma.scheduledShift.findFirst({
                where: { id: existing.shiftId, tenantId: ctx.tenantId },
                select: { id: true },
            });
            if (!parentShift) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        } else {
            const existing = await model.findFirst({ where: { id, tenantId: ctx.tenantId } });
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── GATE 2 · WRITE POLICY (DELETE) ──
    const deleteReach = await resolveReach(ctx);
    const gate2 = hrWriteGate(entity, 'DELETE', deleteReach.mayApprove, ctx.userId, {}, null);
    if (gate2) return gate2;

    try {
        await model.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error(`[HR API] DELETE ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
