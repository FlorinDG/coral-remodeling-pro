/**
 * SHIFT-PROJ-1 · the door: when shifts move to another project, their links to the old project's tasks and files are
 * removed IN THE SAME TRANSACTION as the move (the rule: lib/records/shift-project-links). Called before the update,
 * while the shifts still name their old project. Scoped client only.
 * The crew's progress on a released task link is kept as an open comment on that task (actor = who moved the shift).
 */
import type { ScopedTx } from '@/lib/data/scope';
import { linksLeavingProject, hasWorkerProgress, progressNote, taskProjectIdsOf, type ShiftLinks } from '@/lib/records/shift-project-links';
import { zonedParts } from '@/lib/kernel/shift-time';


export async function releaseOldProjectLinks(tx: ScopedTx, tenantId: string, actorId: string, shiftIds: string[], newProjectId: string | null): Promise<{ tasks: number; files: number; notes: number }> {
    if (!shiftIds.length) return { tasks: 0, files: 0, notes: 0 };
    const shifts = (await tx.scheduledShift.findMany({ where: { id: { in: shiftIds } }, select: { id: true, projectId: true, shiftDate: true, shiftStart: true, shiftEnd: true, userId: true } }))
        .filter(s => (s.projectId ?? null) !== (newProjectId ?? null));
    if (!shifts.length) return { tasks: 0, files: 0, notes: 0 };
    const ids = shifts.map(s => s.id);
    const [taskLinks, fileLinks] = await Promise.all([
        tx.shiftTask.findMany({ where: { shiftId: { in: ids } }, select: { id: true, shiftId: true, taskId: true, status: true, subtasks: true, workerNotes: true, completedBy: true, completedAt: true } }),
        tx.shiftAttachment.findMany({ where: { shiftId: { in: ids } }, select: { id: true, shiftId: true, url: true } }),
    ]);
    const pages = taskLinks.length
        ? await tx.globalPage.findMany({ where: { id: { in: [...new Set(taskLinks.map(l => l.taskId))] } }, select: { id: true, properties: true } })
        : [];
    const projectsOfTask = new Map(pages.map(p => [p.id, taskProjectIdsOf(p.properties)]));

    const dropTasks: string[] = [], dropFiles: string[] = [];
    for (const s of shifts) {
        const links: ShiftLinks = {
            shiftId: s.id,
            oldProjectId: s.projectId ?? null,
            tasks: taskLinks.filter(l => l.shiftId === s.id).map(l => ({ linkId: l.id, taskProjectIds: projectsOfTask.get(l.taskId) ?? [] })),
            files: fileLinks.filter(f => f.shiftId === s.id).map(f => ({ linkId: f.id, url: f.url })),
        };
        const out = linksLeavingProject(tenantId, links, newProjectId);
        dropTasks.push(...out.taskLinkIds);
        dropFiles.push(...out.fileLinkIds);
    }
    // The crew's progress on a released task stays in the old project: an open comment on the task it belongs to.
    const dropping = taskLinks.filter(l => dropTasks.includes(l.id) && projectsOfTask.has(l.taskId));
    const withProgress = dropping.map(l => ({
        link: l,
        progress: {
            status: l.status, subtasks: l.subtasks, workerNotes: l.workerNotes, completedByName: null as string | null,
            completedAt: l.completedAt ? (({ date, time }) => `${date} ${time}`)(zonedParts(l.completedAt)) : null,
        },
    })).filter(x => hasWorkerProgress(x.progress));
    if (withProgress.length) {
        const userIds = [...new Set(withProgress.flatMap(x => [x.link.completedBy, shifts.find(s => s.id === x.link.shiftId)?.userId]).filter((v): v is string => !!v))];
        const users = await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
        const nameOf = (id: string | null | undefined) => (id && users.find(u => u.id === id)) ? (users.find(u => u.id === id)!.name || users.find(u => u.id === id)!.email || '—') : null;
        for (const { link, progress } of withProgress) {
            const sh = shifts.find(s => s.id === link.shiftId)!;
            const body = progressNote({ ...progress, completedByName: nameOf(link.completedBy) }, {
                day: sh.shiftDate, start: sh.shiftStart, end: sh.shiftEnd, workerName: nameOf(sh.userId) || "—",
            });
            await tx.comment.create({ data: { tenantId, pageId: link.taskId, authorId: actorId, body } });
        }
    }
    if (dropTasks.length) await tx.shiftTask.deleteMany({ where: { id: { in: dropTasks } } });
    if (dropFiles.length) await tx.shiftAttachment.deleteMany({ where: { id: { in: dropFiles } } });
    return { tasks: dropTasks.length, files: dropFiles.length, notes: withProgress.length };
}
