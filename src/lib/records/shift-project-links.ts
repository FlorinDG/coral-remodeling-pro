/**
 * SHIFT-PROJ-1 · what a shift keeps when its project changes (Florin 2026-10-10: "when changing project on a shift,
 * the old project tasks and files persist").
 *
 * A shift carries links to its project's work: task assignments (ShiftTask → a task page whose `prop-task-project`
 * names the project) and project files (ShiftAttachment whose url is a file of the project's store,
 * `t_<tenant>/project/<projectId>/…`). When the project changes, the links of the OLD project go; a task with no
 * project, a task of the new project, and a file uploaded to the shift itself stay. Pure.
 */
import { COMMENT_MAX } from './comments';
import { recordFilePrefix } from './file-keys';

/** The storage prefix of a project's files (the scheme of app/actions/files: t_{tenantId}/{recordType}/{recordId}/). */
export function projectFilePrefix(tenantId: string, projectId: string): string {
    return recordFilePrefix(tenantId, 'project', projectId);
}

/** Is this url a file of that project's store? Read from the url's path, decoded; never a guess on the file name. */
export function isProjectFileUrl(url: string, tenantId: string, projectId: string): boolean {
    let path: string;
    try { path = decodeURIComponent(new URL(url, 'http://local').pathname); } catch { return false; }
    return path.includes(`/${projectFilePrefix(tenantId, projectId)}`) || path.startsWith(projectFilePrefix(tenantId, projectId));
}

export interface ShiftLinks {
    shiftId: string;
    oldProjectId: string | null;
    tasks: { linkId: string; taskProjectIds: string[] }[];
    files: { linkId: string; url: string }[];
}

/** The task and file links that leave with the old project when the shift moves to `newProjectId`. */
export function linksLeavingProject(tenantId: string, shift: ShiftLinks, newProjectId: string | null): { taskLinkIds: string[]; fileLinkIds: string[] } {
    if ((shift.oldProjectId ?? null) === (newProjectId ?? null)) return { taskLinkIds: [], fileLinkIds: [] };
    const taskLinkIds = shift.tasks
        .filter(t => t.taskProjectIds.length > 0 && !(newProjectId && t.taskProjectIds.includes(newProjectId)))
        .map(t => t.linkId);
    const fileLinkIds = shift.oldProjectId
        ? shift.files.filter(f => isProjectFileUrl(f.url, tenantId, shift.oldProjectId as string)).map(f => f.linkId)
        : [];
    return { taskLinkIds, fileLinkIds };
}

/**
 * Florin 2026-10-10: the crew's progress on a task link that leaves "should be found in the old project — in the
 * task it belongs to, flagged". It is kept as an OPEN (unresolved) comment on that task, written in the same
 * transaction as the release; the office resolves it once read.
 */
export interface TaskLinkProgress {
    status: string | null;                 // pending | in_progress | done_by_worker
    subtasks: unknown;                     // [{ title, done }]
    workerNotes: string | null;
    completedByName: string | null;
    completedAt: string | null;            // business day + time 'YYYY-MM-DD HH:MM'
}

function checklist(subtasks: unknown): { title: string; done: boolean }[] {
    return Array.isArray(subtasks)
        ? subtasks.filter((s): s is { title: unknown; done?: unknown } => !!s && typeof s === 'object' && 'title' in s)
            .map(s => ({ title: String(s.title ?? '').trim(), done: !!s.done })).filter(s => s.title)
        : [];
}

/** Did the crew leave anything on this link? Untouched links ('pending', no checklist, no notes) leave no trace. */
export function hasWorkerProgress(p: TaskLinkProgress): boolean {
    return (!!p.status && p.status !== 'pending') || checklist(p.subtasks).length > 0 || !!p.workerNotes?.trim();
}

const STATUS_NL: Record<string, string> = { in_progress: 'bezig', done_by_worker: 'klaar volgens de ploeg', pending: 'nog niet begonnen' };

/** The flagged note (the comment body). The shift is named by its day, hours and worker. */
export function progressNote(p: TaskLinkProgress, shift: { day: string; start: string | null; end: string | null; workerName: string }): string {
    const items = checklist(p.subtasks);
    const lines = [
        '⚑ Voortgang van de ploeg bewaard — de dienst is naar een ander project verplaatst',
        `Dienst: ${shift.day}${shift.start ? ` ${shift.start}–${shift.end ?? '?'}` : ''} · ${shift.workerName}`,
        `Status: ${STATUS_NL[p.status ?? 'pending'] ?? p.status}`,
    ];
    if (p.completedAt) lines.push(`Klaar gemeld${p.completedByName ? ` door ${p.completedByName}` : ''} op ${p.completedAt}`);
    if (items.length) {
        lines.push(`Checklist (${items.filter(i => i.done).length}/${items.length}):`);
        for (const i of items) lines.push(`${i.done ? '☑' : '☐'} ${i.title}`);
    }
    if (p.workerNotes?.trim()) lines.push(`Notities: ${p.workerNotes.trim()}`);
    return lines.join('\n').slice(0, COMMENT_MAX);
}
