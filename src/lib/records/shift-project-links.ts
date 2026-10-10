/**
 * SHIFT-PROJ-1 · what a shift keeps when its project changes (Florin 2026-10-10: "when changing project on a shift,
 * the old project tasks and files persist").
 *
 * A shift carries links to its project's work: task assignments (ShiftTask → a task page whose `prop-task-project`
 * names the project) and project files (ShiftAttachment whose url is a file of the project's store,
 * `t_<tenant>/project/<projectId>/…`). When the project changes, the links of the OLD project go; a task with no
 * project, a task of the new project, and a file uploaded to the shift itself stay. Pure.
 */

/** The storage prefix of a project's files (the scheme of app/actions/files: t_{tenantId}/{recordType}/{recordId}/). */
export function projectFilePrefix(tenantId: string, projectId: string): string {
    return `t_${tenantId}/project/${projectId}/`;
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
