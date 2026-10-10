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
import { authSecret } from '@/lib/auth-secret';
import { auth } from '@/auth';
import { scopeFromSession, platformDb, type TenantScopedClient } from '@/lib/data/scope';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import { resolveReach } from '../lib/actor-reach';
import { hrWriteRefusal } from '../lib/write-policy';
import { describeError } from '@/lib/describe-error';
import { isShiftSubmitted, zonedParts } from '@/lib/kernel/shift-time';
import { requestedWindow } from '@/lib/records/shift-window';
import { resolveProjects, projectNameMap } from '@/lib/data/projects';
import crypto from 'crypto';
import { Resend } from 'resend';
import React from 'react';
import InvitationEmail from '@/emails/InvitationEmail';
import { syncSeatQuantities } from '@/lib/stripe';
import { autoLinkIfUnique } from '@/lib/data/entry-shift-match';
import { shiftTaskIdsFor } from '@/lib/data/task-reach';
import { parseScope, seriesData, seriesWhere } from '@/lib/data/shift-series';
import { isShiftSigned, SIGNED_REFUSAL } from '@/lib/data/work-order-lock';
import { recordClockPlace } from '@/lib/data/geo';
import { releaseOldProjectLinks } from '@/lib/data/shift-project-links';
import { after } from 'next/server';
import type { Prisma } from '@prisma/client';
import { isTenantHrRole, isTenantTopRole } from '@/lib/roles';
import { isWritableShiftStatus } from '@/lib/kernel/shift-status';

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

/** HR-ENTITY-SERAPH: the entity's delegate on the TENANT-SCOPED client — never the raw one. */
function getModel(db: TenantScopedClient, entity: string) {
    const modelName = ENTITY_MAP[entity];
    if (!modelName) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (db as any)[modelName];
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
async function contactPageRefusal(db: TenantScopedClient, tenantId: string, data: Record<string, unknown>): Promise<NextResponse | null> {
    if (!('contactPageId' in data)) return null;
    if (data.contactPageId === '' || data.contactPageId === null) { data.contactPageId = null; return null; }
    const page = await db.globalPage.findFirst({
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

/**
 * WO-3 / WB-D · the lock. Which shift does this write touch? A signed work order is closed for
 * EVERY role — no unlock exists. Returns a 409 naming the refusal, or null.
 */
async function signedRefusal(
    db: TenantScopedClient, tenantId: string, entity: string, id: string | null, data: Record<string, unknown>,
): Promise<NextResponse | null> {
    const touched = new Set<string>();
    if (entity === 'shifts' && id) touched.add(id);
    if (entity === 'clock-entries' || entity === 'shift-tasks' || entity === 'shift-attachments') {
        if (typeof data.shiftId === 'string' && data.shiftId) touched.add(data.shiftId);   // moving INTO / creating on
        if (id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = await (getModel(db, entity) as any)?.findUnique({ where: { id }, select: { shiftId: true } });
            if (row?.shiftId) touched.add(row.shiftId);                                      // already ON
        }
    }
    for (const shiftId of touched) {
        if (await isShiftSigned(tenantId, shiftId)) {
            return NextResponse.json({ error: `${SIGNED_REFUSAL}: the client signed this work order — it can no longer be changed` }, { status: 409 });
        }
    }
    return null;
}

/** A series action never reaches a signed shift. */
async function withoutSigned(db: TenantScopedClient, tenantId: string, where: Prisma.ScheduledShiftWhereInput | null): Promise<Prisma.ScheduledShiftWhereInput | null> {
    if (!where) return null;
    const ids = (await db.scheduledShift.findMany({ where, select: { id: true } })).map(r => r.id);
    if (!ids.length) return where;
    const signed = await db.auditLog.findMany({
        where: { tenantId, entityType: 'shift', action: 'sign', entityId: { in: ids } },
        select: { entityId: true },
    });
    return signed.length ? { AND: [where, { id: { notIn: signed.map(r => r.entityId) } }] } : where;
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ entity: string }> }
) {
    const ctx = await getTenantAndUser();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // HR-ENTITY-SERAPH: every read and write below goes through the tenant-scoped client (the seraph enforces the
    // tenant; the hand-written tenantId filters stay as a second lock).
    const db = await scopeFromSession();

    const { entity } = await params;

    const model = getModel(db, entity);
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
    // One record by id (the werkbon viewer read every clock entry, employee and shift of the tenant to show one).
    const idParam = url.searchParams.get('id');
    if (idParam) where.id = idParam;

    // SCHED-WINDOW-1: a list of shifts is a window of days (lib/records/shift-window) — never all of history.
    // Without from/to the bounded default applies. Leave (time-off) is windowed when a range is asked (the scheduler);
    // the leave register and balances read it whole (a few rows per person per year).
    if (((entity === 'shifts' || entity === 'scheduled-shifts') && !idParam) || (entity === 'time-off' && (url.searchParams.has('from') || url.searchParams.has('to')))) {
        const asked = requestedWindow(url.searchParams.get('from'), url.searchParams.get('to'), zonedParts(new Date()).date);
        if (!asked.ok) return NextResponse.json({ error: asked.error }, { status: 400 });
        const { from, to } = asked.window;
        if (entity === 'time-off') {
            // Overlap. The dates are strings that may carry a time ('…T08:00'): '<to>T~' sorts after every time of that day.
            where.startDate = { lte: `${to}T~` };
            where.endDate = { gte: from };
        } else {
            where.shiftDate = { gte: from, lte: to };
        }
    }

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
            const pages = await db.globalPage.findMany({
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
            const tenant = await platformDb().tenant.findUnique({
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
                    const shifts = await db.scheduledShift.findMany({
                        where: { userId: { in: accessibleIds }, tenantId: ctx.tenantId },
                        select: { projectId: true }
                    });
                    onlyIds = Array.from(new Set(shifts.map(s => s.projectId).filter(Boolean))) as string[];
                }
                if (idParam) onlyIds = onlyIds ? onlyIds.filter(x => x === idParam) : [idParam];   // one project, within reach
                const projects = await resolveProjects(ctx.tenantId, onlyIds ? { onlyIds } : undefined);
                return NextResponse.json(projects);
            }

            if (entity === 'erp-tasks') {
                const tasksDbId = locked['tasks'] || 'db-tasks';

                // Scope filter: admin/accountant roles see all tasks.
                // Employee/workforce role sees only tasks assigned to or created by them.
                // Mirrors the ASSIGNED_AND_OWN rule in access-control.ts.
                // Office roles see all tasks (owners were filtered like crew — isTenantHrRole is the one list).
                const isAdminRole = isTenantHrRole(ctx.role) || ctx.role === 'ACCOUNTANT';
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
                        // a task the office put on one of their shifts is theirs too (task-reach.ts)
                        { id: { in: await shiftTaskIdsFor(ctx.tenantId, accessibleIds) } },
                    ];
                }

                const tasks = await db.globalPage.findMany({
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

        // LEAVE-1 (Florin 2026-10-08): leave is not a shift. Absences are read from 'time-off' (kernel/absence.ts);
        // the synthetic 08:00–17:00 'leave' rows that were mixed into this list are gone.

        // Enrich user names for clock-entries, time-off, and shifts
        if (entity === 'clock-entries' || entity === 'time-off' || entity === 'shifts') {
            const userIds = [...new Set(records.map((r: any) => r.userId).filter(Boolean))] as string[];
            if (userIds.length > 0) {
                const users = await db.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, name: true, email: true }
                });
                const employees = await db.employee.findMany({
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
                    const legacyEmployees = await db.employee.findMany({
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
                const shiftIds = records.map((r: any) => r.id).filter(Boolean);
                if (shiftIds.length > 0) {
                    const entries = await db.clockEntry.findMany({
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
    // HR-ENTITY-SERAPH: every read and write below goes through the tenant-scoped client (the seraph enforces the
    // tenant; the hand-written tenantId filters stay as a second lock).
    const db = await scopeFromSession();

    const { entity } = await params;

    if (entity === 'audit-logs') {
        return NextResponse.json({ error: 'Audit logs are immutable' }, { status: 403 });
    }

    const model = getModel(db, entity);
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
        const parent = await db.scheduledShift.findFirst({
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
    const locked = await signedRefusal(db, ctx.tenantId, entity, null, data);
    if (locked) return locked;
    if (entity === 'shifts') {
        const bad = await contactPageRefusal(db, ctx.tenantId, data);
        if (bad) return bad;
    }
    if (entity === 'clock-entries') {
        // Facts the server records about an act — never values a client supplies (any role).
        delete data.approvedBy;
        // TS-INV-1: invoiced is set ONLY by markHoursInvoiced / unmarkHoursInvoiced (audited)
        delete data.invoicedAt; delete data.invoicedBy; delete data.invoiceRef;
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

    // LEAVE-1: a shift is never leave. Leave is a TimeOffRequest, written to 'time-off' (SCH-1's reroute
    // made one single-day request per day; the scheduler now writes the range itself).
    if ((entity === 'shifts' || entity === 'scheduled-shifts') && 'status' in data && !isWritableShiftStatus(data.status)) {
        return NextResponse.json({ error: data.status === 'leave' ? 'leave_is_time_off' : `invalid_shift_status: ${String(data.status)}` }, { status: 400 });
    }
    // Who approved a leave is a fact the server records (the scheduler's leave is approved by its author).
    if (entity === 'time-off') {
        delete data.reviewedBy; delete data.reviewedAt;
        if (data.status === 'approved') { data.reviewedBy = ctx.userId; data.reviewedAt = new Date(); }
    }

    // ── PRE-CREATE Automations ───────────────────────────────────────
    let parentShift: { id: string; projectId: string | null; status?: string } | null = null;
    if (entity === 'clock-entries') {
        // Seraph (checklist item 8): the worker an entry is FOR must be a user of THIS tenant.
        // ClockEntry.userId has no FK; without this a foreign user's id was accepted as-is.
        const subject = await db.user.findFirst({
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
                const open = await db.clockEntry.findFirst({
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
            const employee = await db.employee.findFirst({
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
                parentShift = await db.scheduledShift.findFirst({
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
        // GEO-1: where the clock-in happened (address + distance to site) — after the response,
        // never delaying or blocking the clock event.
        if (entity === 'clock-entries' && (record as { clockInLatitude?: number | null }).clockInLatitude != null) {
            const entryId = (record as { id: string }).id;
            after(() => recordClockPlace(ctx.tenantId, entryId, 'in'));
        }
        // SHIFT-LINK-1: a RECORDED entry (manual / late, has clockOutTime) with no shift is linked when
        // exactly one of the worker's shifts that day overlaps it. Live clock-ins without a shift are a
        // deliberate choice and stay unlinked. Ambiguous → surfaced in the review, never guessed.
        if (entity === 'clock-entries' && !(record as { shiftId?: string | null }).shiftId && (record as { clockOutTime?: Date | null }).clockOutTime) {
            try {
                const linked = await autoLinkIfUnique((record as { id: string }).id, { tenantId: ctx.tenantId, userId: ctx.userId });
                if (linked) (record as { shiftId?: string }).shiftId = linked;
            } catch (err) {
                console.error('[HR API] SHIFT-LINK-1 auto-link failed:', err);
                warnings.push('shift_link_failed');
            }
        }
        // SCHED-STATUS-1: no status is written on clock-in — 'in progress' and 'late' are derived from the shift's
        // clock entries by kernel/shift-status.ts (HRA-2's stored 'in-progress' stayed behind after clock-out).

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
    const expectedSignature = crypto.createHmac('sha256', authSecret()).update(Buffer.from(payloadBase64, 'base64').toString('utf-8')).digest('hex');
    
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
    // HR-ENTITY-SERAPH: every read and write below goes through the tenant-scoped client (the seraph enforces the
    // tenant; the hand-written tenantId filters stay as a second lock).
    const db = await scopeFromSession();

    const { entity } = await params;

    if (entity === 'audit-logs') {
        return NextResponse.json({ error: 'Audit logs are immutable' }, { status: 403 });
    }

    const model = getModel(db, entity);
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
            const member = await (db as any).hrTeamMember.findUnique({ 
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
            const parentShift = await db.scheduledShift.findFirst({
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

    // LEAVE-1 / SCHED-STATUS-1: a shift's status is one of the kernel's stored statuses — never 'leave'.
    if ((entity === 'shifts' || entity === 'scheduled-shifts') && 'status' in data && !isWritableShiftStatus(data.status)) {
        return NextResponse.json({ error: data.status === 'leave' ? 'leave_is_time_off' : `invalid_shift_status: ${String(data.status)}` }, { status: 400 });
    }

    // ── WO-3 · a signed work order is closed for every role ──
    {
        const locked = await signedRefusal(db, ctx.tenantId, entity, id, data);
        if (locked) return locked;
    }

    // ── GATE 2 · WRITE POLICY (PATCH) ──
    if (entity === 'shifts') {
        const bad = await contactPageRefusal(db, ctx.tenantId, data);
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
        // TS-INV-1: invoiced is set ONLY by markHoursInvoiced / unmarkHoursInvoiced (audited)
        delete data.invoicedAt; delete data.invoicedBy; delete data.invoiceRef;
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
    let seriesCount: number | null = null;   // SCH-8: other shifts changed by a series edit

        // --- CLOCK ENTRIES INTERCEPT: Audit and Edit Guard ---
        if (entity === 'clock-entries') {
            const existingEntry = await db.clockEntry.findUnique({ where: { id } });
            if (!existingEntry || existingEntry.tenantId !== ctx.tenantId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            // TS-INV-1: invoiced hours stay approved and billable — unmark them first (with a reason).
            if (existingEntry.invoicedAt) {
                if (('approvalStatus' in data && data.approvalStatus !== 'approved') || ('billable' in data && data.billable === false)) {
                    return NextResponse.json({ error: 'invoiced: these hours are on an invoice — unmark them first' }, { status: 409 });
                }
            }

            // Edit Guard — approved hours: a written reason ALWAYS (it goes into the audit trail), and
            // either the time-limited unlock or the tenant owner (Florin 2026-10-02: the highest authority
            // is never locked out of a bon it approved).
            const editReason = typeof data.editReason === 'string' ? data.editReason.trim().slice(0, 1000) : '';
            delete data.editReason;
            if (existingEntry.approvalStatus === 'approved') {
                const isForceClockOut = !existingEntry.clockOutTime && data.clockOutTime;
                if (!isForceClockOut) {
                    const isUnlocked = await verifyUnlockCookie(ctx.tenantId, ctx.userId);
                    if (!isUnlocked && !isTenantTopRole(ctx.role)) {
                        return NextResponse.json({ error: 'Editing approved entries requires unlock' }, { status: 403 });
                    }
                    if (editReason.length < 3) {
                        return NextResponse.json({ error: 'edit_reason_required: say why approved hours are changed' }, { status: 400 });
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
                reason: data.editedAfterApproval ? `edited-after-approval: ${editReason}` : (editReason || null),
            });

            // Execute in transaction
            record = await db.$transaction(async tx => {
                const updated = await tx.clockEntry.update({ where: { id }, data });
                await buildAuditLogOperation(tx, auditData);
                return updated;
            });
        } else {
            // SCH-8: "this and following" / "all in series" — the other shifts first, in ONE statement.
            const scope = entity === 'shifts' ? parseScope(url.searchParams.get('scope')) : 'occurrence';
            if (scope !== 'occurrence') {
                if (!patchReach.mayApprove) return NextResponse.json({ error: 'forbidden: series edits are for planners' }, { status: 403 });
                const anchor = await db.scheduledShift.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, seriesId: true, shiftDate: true } });
                const where = anchor ? await withoutSigned(db, ctx.tenantId, seriesWhere(ctx.tenantId, anchor, scope)) : null;
                const fields = seriesData(data);
                if (where && Object.keys(fields).length) {
                    // ONE transaction: the series and the edited shift change together or not at all.
                    const [res, anchorRow] = await db.$transaction(async tx => {
                        // SHIFT-PROJ-1: a series moved to another project drops the old project's task and file links.
                        if ('projectId' in fields) {
                            const others = (await tx.scheduledShift.findMany({ where, select: { id: true } })).map(r => r.id);
                            await releaseOldProjectLinks(tx, ctx.tenantId, [id, ...others], (fields.projectId as string | null) || null);
                        }
                        return [
                            await tx.scheduledShift.updateMany({ where, data: { ...fields, lastEditedBy: ctx.userId } }),
                            await tx.scheduledShift.update({ where: { id }, data: data as Prisma.ScheduledShiftUncheckedUpdateInput }),
                        ] as const;
                    });
                    seriesCount = res.count;
                    record = anchorRow;
                }
            }
            if (record === undefined && entity === 'shifts' && 'projectId' in data) {
                // SHIFT-PROJ-1: the move and the release of the old project's task and file links, together.
                record = await db.$transaction(async tx => {
                    await releaseOldProjectLinks(tx, ctx.tenantId, [id], (data.projectId as string | null) || null);
                    return tx.scheduledShift.update({ where: { id }, data: data as Prisma.ScheduledShiftUncheckedUpdateInput });
                });
            }
            if (record === undefined) record = await model.update({ where: { id }, data });
        }

        // ── PATCH Automations ──────────────────────────────────────────
        // GEO-1: the clock-out's place, recorded after the response.
        if (entity === 'clock-entries' && data.clockOutLatitude != null) {
            after(() => recordClockPlace(ctx.tenantId, id, 'out'));
        }
        // Approval / rejection of clock entry requests (late_entry, manual_hours)
        if (entity === 'approval-requests' && (data.status === 'approved' || data.status === 'rejected')) {
            try {
                const approval = record as any;
                if (approval.entityType === 'clock_entry') {
                    const reqData = (approval.requestData as any) || {};
                    const existingClockEntryId = reqData.id || reqData.clockEntryId || reqData.entityId;

                    if (existingClockEntryId) {
                        // Clock entry was created at submit time (late_entry) — update approval status
                        await db.clockEntry.updateMany({
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
                        const entry = await db.clockEntry.create({
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
                        // NO ad-hoc shifts (Florin 2026-10-04): the entry keeps its project; no shift is invented.
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

        const withCount = seriesCount !== null ? { ...(record as object), seriesUpdated: seriesCount + 1 } : record;
        return NextResponse.json(
            warnings.length > 0 ? { ...(typeof withCount === 'object' && withCount !== null ? withCount : {}), warnings } : withCount
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
    // HR-ENTITY-SERAPH: every read and write below goes through the tenant-scoped client (the seraph enforces the
    // tenant; the hand-written tenantId filters stay as a second lock).
    const db = await scopeFromSession();

    const { entity } = await params;

    if (entity === 'audit-logs') {
        return NextResponse.json({ error: 'Audit logs are immutable' }, { status: 403 });
    }

    const model = getModel(db, entity);
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
            const member = await (db as any).hrTeamMember.findUnique({ 
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
            const parentShift = await db.scheduledShift.findFirst({
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

    // ── WO-3 · a signed work order is closed for every role ──
    {
        const locked = await signedRefusal(db, ctx.tenantId, entity, id, {});
        if (locked) return locked;
    }

    // ── GATE 2 · WRITE POLICY (DELETE) ──
    if (entity === 'clock-entries') {
        const row = await db.clockEntry.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { invoicedAt: true } });
        if (row?.invoicedAt) return NextResponse.json({ error: 'invoiced: these hours are on an invoice — unmark them first' }, { status: 409 });
    }
    const deleteReach = await resolveReach(ctx);
    const gate2 = hrWriteGate(entity, 'DELETE', deleteReach.mayApprove, ctx.userId, {}, null);
    if (gate2) return gate2;

    try {
        // SCH-8: "this and following" / "all in series" — one statement; a shift that already has
        // hours on it is never deleted by a series action (it is kept and counted).
        const scope = entity === 'shifts' ? parseScope(url.searchParams.get('scope')) : 'occurrence';
        if (scope !== 'occurrence') {
            if (!deleteReach.mayApprove) return NextResponse.json({ error: 'forbidden: series deletes are for planners' }, { status: 403 });
            const anchor = await db.scheduledShift.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, seriesId: true, shiftDate: true } });
            const where = anchor ? await withoutSigned(db, ctx.tenantId, seriesWhere(ctx.tenantId, anchor, scope)) : null;
            let deleted = 0, kept = 0;
            if (where) {
                // ONE transaction: the series and the shift itself are deleted together or not at all.
                const [res, withHours] = await db.$transaction(async tx => [
                    await tx.scheduledShift.deleteMany({ where: { ...where, clockEntries: { none: {} } } }),
                    await tx.scheduledShift.count({ where }),
                    await tx.scheduledShift.delete({ where: { id } }),
                ] as const);
                deleted = res.count; kept = withHours;
            } else {
                await model.delete({ where: { id } });
            }
            return NextResponse.json({ success: true, seriesDeleted: deleted + 1, seriesKept: kept });
        }
        await model.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error(`[HR API] DELETE ${entity} error:`, error);
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
