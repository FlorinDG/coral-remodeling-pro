"use server";
/**
 * TASK-CREW-1 (Florin 2026-09-30): the crew updates the status of tasks assigned to them and writes
 * notes with photos; the app keeps a detailed log of changes, READ-ONLY for every role.
 *
 * - A task is a page in the tenant's TASKS system database — the binding is READ
 *   (`database.logicalKey = 'tasks'`), never parsed from an id (kernel rule).
 * - Who may act: the task's assignees, and tenant HR roles. Everyone in the tenant who can open the
 *   task may READ its log and submitted notes.
 * - Notes: editable by their author while `draft`; FROZEN at `submitted` (corrections go through the
 *   supervisor, outside the app — future: an in-app correction request).
 * - Every status change and every note submission writes AuditLog in the SAME transaction as the
 *   change (CORE-3: a record and its side effect must never disagree). AuditLog is immutable.
 */
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { isTenantHrRole } from "@/lib/roles";
import { buildAuditLogData, buildAuditLogOperation } from "@/lib/audit";
import { normalizeStoredPhotos, type StoredPhoto } from "@/lib/files";
import { isOnMyShift } from "./task-reach";


export type TaskStage = 'todo' | 'busy' | 'done';
/** Canonical status option ids of the tasks database (DatabaseClone). */
const STAGE_TO_OPTION: Record<TaskStage, string> = { todo: 't-todo', busy: 't-prog', done: 't-done' };

type Fail = { ok: false; error: 'unauthorized' | 'not_found' | 'forbidden' | 'frozen' | 'empty' | 'failed'; detail?: string };

async function actor() {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    return tenantId && userId ? { tenantId, userId, role, name: session?.user?.name || null } : null;
}

async function findTask(tenantId: string, taskId: string) {
    return prisma.globalPage.findFirst({
        where: { id: taskId, database: { tenantId, logicalKey: 'tasks' } },
        select: { id: true, properties: true, assignedTo: true },
    });
}

function taskTitle(props: unknown): string {
    const p = (props || {}) as Record<string, unknown>;
    return String(p.title || p.name || '').trim() || '—';
}

const mayAct = async (a: { tenantId: string; userId: string; role?: string }, task: { id: string; assignedTo: string[] }) =>
    task.assignedTo.includes(a.userId) || isTenantHrRole(a.role) || isOnMyShift(a.tenantId, a.userId, task.id);

// ── Status ──────────────────────────────────────────────────────────────────
export async function setTaskStage(taskId: string, stage: TaskStage): Promise<{ ok: true } | Fail> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    if (!(stage in STAGE_TO_OPTION)) return { ok: false, error: 'failed', detail: `unknown stage ${stage}` };
    const task = await findTask(a.tenantId, taskId);
    if (!task) return { ok: false, error: 'not_found' };
    if (!(await mayAct(a, task))) return { ok: false, error: 'forbidden' };

    const props = { ...((task.properties || {}) as Record<string, unknown>) };
    const before = { status: props['prop-task-status'] ?? null, completedAt: props['prop-task-completed-at'] ?? null };
    props['prop-task-status'] = STAGE_TO_OPTION[stage];
    props['prop-task-completed-at'] = stage === 'done' ? new Date().toISOString() : null;
    if (before.status === props['prop-task-status']) return { ok: true };

    try {
        const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
            entityType: 'task', entityId: task.id, action: 'status', field: 'prop-task-status',
            before, after: { status: props['prop-task-status'], completedAt: props['prop-task-completed-at'] },
        });
        await prisma.$transaction([
            prisma.globalPage.update({ where: { id: task.id }, data: { properties: props as object, lastEditedBy: a.userId } }),
            buildAuditLogOperation(prisma, audit),
        ]);
        return { ok: true };
    } catch (err) {
        console.error('[setTaskStage] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}

// ── Notes ───────────────────────────────────────────────────────────────────
export interface TaskNoteView {
    id: string; authorId: string; authorName: string | null; text: string; photos: StoredPhoto[];
    status: 'draft' | 'submitted'; submittedAt: string | null; updatedAt: string; mine: boolean;
}

/** Create or update MY draft. A submitted note is frozen. */
export async function saveTaskNoteDraft(input: { taskId: string; noteId?: string; text: string; photos: StoredPhoto[] }):
    Promise<{ ok: true; noteId: string } | Fail> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const task = await findTask(a.tenantId, input.taskId);
    if (!task) return { ok: false, error: 'not_found' };
    if (!(await mayAct(a, task))) return { ok: false, error: 'forbidden' };
    const photos = normalizeStoredPhotos(input.photos);
    const text = (input.text || '').slice(0, 10_000);

    try {
        if (input.noteId) {
            const note = await prisma.taskNote.findFirst({ where: { id: input.noteId, tenantId: a.tenantId, taskId: task.id } });
            if (!note || note.authorId !== a.userId) return { ok: false, error: 'not_found' };
            if (note.status !== 'draft') return { ok: false, error: 'frozen' };
            await prisma.taskNote.update({ where: { id: note.id }, data: { text, photos: photos as object[] } });
            return { ok: true, noteId: note.id };
        }
        const created = await prisma.taskNote.create({
            data: { tenantId: a.tenantId, taskId: task.id, taskTitle: taskTitle(task.properties), authorId: a.userId, text, photos: photos as object[] },
        });
        return { ok: true, noteId: created.id };
    } catch (err) {
        console.error('[saveTaskNoteDraft] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}

/** Submit MY draft — from here on it is frozen, and the log holds its content. */
export async function submitTaskNote(noteId: string): Promise<{ ok: true } | Fail> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const note = await prisma.taskNote.findFirst({ where: { id: noteId, tenantId: a.tenantId } });
    if (!note || note.authorId !== a.userId) return { ok: false, error: 'not_found' };
    if (note.status !== 'draft') return { ok: false, error: 'frozen' };
    const photos = normalizeStoredPhotos(note.photos);
    if (!note.text.trim() && photos.length === 0) return { ok: false, error: 'empty' };

    const submittedAt = new Date();
    try {
        const audit = await buildAuditLogData({ tenantId: a.tenantId, userId: a.userId }, {
            entityType: 'task', entityId: note.taskId || `deleted:${note.id}`, action: 'note_submit', field: 'taskNote',
            before: null,
            after: { noteId: note.id, text: note.text, photos: photos.map(p => p.key), submittedAt: submittedAt.toISOString() },
        });
        await prisma.$transaction([
            prisma.taskNote.update({ where: { id: note.id }, data: { status: 'submitted', submittedAt } }),
            buildAuditLogOperation(prisma, audit),
        ]);
        return { ok: true };
    } catch (err) {
        console.error('[submitTaskNote] failed:', err);
        return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
}

/** Discard MY draft (a draft was never part of the record). */
export async function deleteTaskNoteDraft(noteId: string): Promise<{ ok: true } | Fail> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const note = await prisma.taskNote.findFirst({ where: { id: noteId, tenantId: a.tenantId } });
    if (!note || note.authorId !== a.userId) return { ok: false, error: 'not_found' };
    if (note.status !== 'draft') return { ok: false, error: 'frozen' };
    await prisma.taskNote.delete({ where: { id: note.id } });
    return { ok: true };
}

// ── The read-only record ─────────────────────────────────────────────────────
export interface TaskActivityEntry {
    id: string; at: string; actorLabel: string; action: string; before: unknown; after: unknown;
}

/** Submitted notes (everyone) + my own drafts + the change log (everyone). Read-only. */
export async function getTaskRecord(taskId: string): Promise<
    { ok: true; stage: TaskStage; canAct: boolean; notes: TaskNoteView[]; activity: TaskActivityEntry[] } | Fail
> {
    const a = await actor();
    if (!a) return { ok: false, error: 'unauthorized' };
    const task = await findTask(a.tenantId, taskId);
    if (!task) return { ok: false, error: 'not_found' };

    const [notes, logs] = await Promise.all([
        prisma.taskNote.findMany({
            where: { tenantId: a.tenantId, taskId: task.id, OR: [{ status: 'submitted' }, { authorId: a.userId }] },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.auditLog.findMany({
            where: { tenantId: a.tenantId, entityType: 'task', entityId: task.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, createdAt: true, actorLabel: true, action: true, before: true, after: true },
        }),
    ]);
    const authorIds = Array.from(new Set(notes.map(n => n.authorId)));
    const users = authorIds.length
        ? await prisma.user.findMany({ where: { id: { in: authorIds }, tenantId: a.tenantId }, select: { id: true, name: true } })
        : [];
    const nameOf = new Map(users.map(u => [u.id, u.name]));

    const status = String(((task.properties || {}) as Record<string, unknown>)['prop-task-status'] || '').toLowerCase();
    const stage: TaskStage = status.includes('done') ? 'done' : (status.includes('prog') || status.includes('doing')) ? 'busy' : 'todo';

    return {
        ok: true,
        stage,
        canAct: await mayAct(a, task),
        notes: notes.map(n => ({
            id: n.id, authorId: n.authorId, authorName: nameOf.get(n.authorId) || null, text: n.text,
            photos: normalizeStoredPhotos(n.photos), status: n.status === 'submitted' ? 'submitted' : 'draft',
            submittedAt: n.submittedAt ? n.submittedAt.toISOString() : null, updatedAt: n.updatedAt.toISOString(),
            mine: n.authorId === a.userId,
        })),
        activity: logs.map(l => ({ id: l.id, at: l.createdAt.toISOString(), actorLabel: l.actorLabel, action: l.action, before: l.before, after: l.after })),
    };
}
