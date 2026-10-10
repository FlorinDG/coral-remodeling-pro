/**
 * SHIFT-PROJ-1 · the door: when shifts move to another project, their links to the old project's tasks and files are
 * removed IN THE SAME TRANSACTION as the move (the rule: lib/records/shift-project-links). Called before the update,
 * while the shifts still name their old project. Scoped client only.
 */
import type { ScopedTx } from '@/lib/data/scope';
import { linksLeavingProject, type ShiftLinks } from '@/lib/records/shift-project-links';

function projectIdsOf(properties: unknown): string[] {
    const v = (properties as Record<string, unknown> | null)?.['prop-task-project'];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : typeof v === 'string' && v ? [v] : [];
}

export async function releaseOldProjectLinks(tx: ScopedTx, tenantId: string, shiftIds: string[], newProjectId: string | null): Promise<{ tasks: number; files: number }> {
    if (!shiftIds.length) return { tasks: 0, files: 0 };
    const shifts = (await tx.scheduledShift.findMany({ where: { id: { in: shiftIds } }, select: { id: true, projectId: true } }))
        .filter(s => (s.projectId ?? null) !== (newProjectId ?? null));
    if (!shifts.length) return { tasks: 0, files: 0 };
    const ids = shifts.map(s => s.id);
    const [taskLinks, fileLinks] = await Promise.all([
        tx.shiftTask.findMany({ where: { shiftId: { in: ids } }, select: { id: true, shiftId: true, taskId: true } }),
        tx.shiftAttachment.findMany({ where: { shiftId: { in: ids } }, select: { id: true, shiftId: true, url: true } }),
    ]);
    const pages = taskLinks.length
        ? await tx.globalPage.findMany({ where: { id: { in: [...new Set(taskLinks.map(l => l.taskId))] } }, select: { id: true, properties: true } })
        : [];
    const projectsOfTask = new Map(pages.map(p => [p.id, projectIdsOf(p.properties)]));

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
    if (dropTasks.length) await tx.shiftTask.deleteMany({ where: { id: { in: dropTasks } } });
    if (dropFiles.length) await tx.shiftAttachment.deleteMany({ where: { id: { in: dropFiles } } });
    return { tasks: dropTasks.length, files: dropFiles.length };
}
