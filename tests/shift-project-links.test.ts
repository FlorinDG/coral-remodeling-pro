/**
 * SHIFT-PROJ-1 (Florin 2026-10-10): "when changing project on a shift, the old project tasks and files persist."
 * The old project's task assignments and project-file links leave with it, in the same transaction as the move.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linksLeavingProject, isProjectFileUrl, hasWorkerProgress, progressNote } from '../src/lib/records/shift-project-links.ts';
import { releaseOldProjectLinks } from '../src/lib/data/shift-project-links.ts';

const T = 'ten1';
const fileOf = (p: string, name: string) => `https://abc.public.blob.vercel-storage.com/t_${T}/project/${p}/${name}`;

describe('SHIFT-PROJ-1 · the rule (core)', () => {
    test('a project file is recognised by its store path, not its name', () => {
        assert.equal(isProjectFileUrl(fileOf('p-old', 'plan.pdf'), T, 'p-old'), true);
        assert.equal(isProjectFileUrl(fileOf('p-old', 'plan.pdf'), T, 'p-new'), false);
        assert.equal(isProjectFileUrl(`https://x/t_${T}/shift/s1/photo.jpg`, T, 'p-old'), false);
        assert.equal(isProjectFileUrl(`https://x/t_other/project/p-old/plan.pdf`, T, 'p-old'), false);
        assert.equal(isProjectFileUrl('not a url %%%', T, 'p-old'), false);
    });
    const shift = {
        shiftId: 's1', oldProjectId: 'p-old',
        tasks: [
            { linkId: 'l-old', taskProjectIds: ['p-old'] },
            { linkId: 'l-new', taskProjectIds: ['p-new'] },
            { linkId: 'l-none', taskProjectIds: [] },
        ],
        files: [
            { linkId: 'f-old', url: fileOf('p-old', 'plan.pdf') },
            { linkId: 'f-upload', url: `https://x/t_${T}/shift/s1/photo.jpg` },
        ],
    };
    test('moving to another project drops the old project\'s tasks and files; keeps the new project\'s, unprojected tasks, uploads', () => {
        assert.deepEqual(linksLeavingProject(T, shift, 'p-new'), { taskLinkIds: ['l-old'], fileLinkIds: ['f-old'] });
    });
    test('clearing the project drops every project task and the old project\'s files', () => {
        assert.deepEqual(linksLeavingProject(T, shift, null), { taskLinkIds: ['l-old', 'l-new'], fileLinkIds: ['f-old'] });
    });
    test('the same project changes nothing', () => {
        assert.deepEqual(linksLeavingProject(T, shift, 'p-old'), { taskLinkIds: [], fileLinkIds: [] });
    });
});

describe('SHIFT-PROJ-1 · the crew\'s progress stays in the old project (Florin)', () => {
    const base = { status: 'pending', subtasks: [], workerNotes: null, completedByName: null, completedAt: null };
    test('an untouched link leaves no trace; status, a checklist or notes do', () => {
        assert.equal(hasWorkerProgress(base), false);
        assert.equal(hasWorkerProgress({ ...base, status: 'in_progress' }), true);
        assert.equal(hasWorkerProgress({ ...base, subtasks: [{ title: 'Voegen', done: false }] }), true);
        assert.equal(hasWorkerProgress({ ...base, workerNotes: '  tegels op  ' }), true);
        assert.equal(hasWorkerProgress({ ...base, workerNotes: '   ' }), false);
    });
    test('the note names the shift and carries status, checklist and notes, flagged', () => {
        const note = progressNote({ ...base, status: 'done_by_worker', subtasks: [{ title: 'Voegen', done: true }, { title: 'Silicone', done: false }], workerNotes: 'Kit op', completedByName: 'Jan', completedAt: '2026-10-09 16:40' },
            { day: '2026-10-09', start: '08:00', end: '16:30', workerName: 'Jan' });
        assert.match(note, /^⚑ /);
        assert.match(note, /Dienst: 2026-10-09 08:00–16:30 · Jan/);
        assert.match(note, /Status: klaar volgens de ploeg/);
        assert.match(note, /Klaar gemeld door Jan op 2026-10-09 16:40/);
        assert.match(note, /Checklist \(1\/2\):\n☑ Voegen\n☐ Silicone/);
        assert.match(note, /Notities: Kit op/);
    });
});

describe('SHIFT-PROJ-1 · the door', () => {
    function fakeTx() {
        const deleted = { shiftTask: [] as string[], shiftAttachment: [] as string[] };
        const comments: { pageId: string; authorId: string; body: string; tenantId: string }[] = [];
        const order: string[] = [];
        const tx = {
            scheduledShift: { findMany: async () => [
                { id: 's1', projectId: 'p-old', shiftDate: '2026-10-09', shiftStart: '08:00', shiftEnd: '16:30', userId: 'u-crew' },
                { id: 's2', projectId: 'p-new', shiftDate: '2026-10-10', shiftStart: '08:00', shiftEnd: '16:30', userId: 'u-crew' },
            ] },
            shiftTask: {
                findMany: async () => [
                    { id: 'l-old', shiftId: 's1', taskId: 'task-a', status: 'in_progress', subtasks: [], workerNotes: 'half', completedBy: null, completedAt: null },
                    { id: 'l-old-untouched', shiftId: 's1', taskId: 'task-b', status: 'pending', subtasks: [], workerNotes: null, completedBy: null, completedAt: null },
                    { id: 'l-keep', shiftId: 's2', taskId: 'task-a', status: 'pending', subtasks: [], workerNotes: null, completedBy: null, completedAt: null },
                ],
                deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { order.push('delete'); deleted.shiftTask.push(...where.id.in); return { count: where.id.in.length }; },
            },
            shiftAttachment: {
                findMany: async () => [{ id: 'f-old', shiftId: 's1', url: fileOf('p-old', 'plan.pdf') }],
                deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { deleted.shiftAttachment.push(...where.id.in); return { count: where.id.in.length }; },
            },
            globalPage: { findMany: async () => [
                { id: 'task-a', properties: { 'prop-task-project': ['p-old'] } },
                { id: 'task-b', properties: { 'prop-task-project': ['p-old'] } },
            ] },
            user: { findMany: async () => [{ id: 'u-crew', name: 'Jan', email: null }] },
            comment: { create: async ({ data }: { data: { pageId: string; authorId: string; body: string; tenantId: string } }) => { order.push('comment'); comments.push(data); return { id: 'c1' }; } },
        };
        return { tx, deleted, comments, order };
    }
    test('only the shifts that change project lose links; progress is written to the old task BEFORE the link goes', async () => {
        const { tx, deleted, comments, order } = fakeTx();
        const n = await releaseOldProjectLinks(tx as never, T, 'u-planner', ['s1', 's2'], 'p-new');
        assert.deepEqual(n, { tasks: 2, files: 1, notes: 1 });
        assert.deepEqual(deleted, { shiftTask: ['l-old', 'l-old-untouched'], shiftAttachment: ['f-old'] });
        assert.equal(comments.length, 1);
        assert.equal(comments[0].pageId, 'task-a');
        assert.equal(comments[0].authorId, 'u-planner');
        assert.equal(comments[0].tenantId, T);
        assert.match(comments[0].body, /Status: bezig[\s\S]*Notities: half/);
        assert.match(comments[0].body, /· Jan/);
        assert.deepEqual(order, ['comment', 'delete']);
    });
});

describe('SHIFT-PROJ-1 · the route', () => {
    const ROUTE = readFileSync('src/app/api/hr/[entity]/route.ts', 'utf8');
    test('a single shift and a series release the old links inside the transaction that moves them', () => {
        assert.match(ROUTE, /await releaseOldProjectLinks\(tx, ctx\.tenantId, ctx\.userId, \[id\], \(data\.projectId as string \| null\) \|\| null\);\s*return tx\.scheduledShift\.update/);
        assert.match(ROUTE, /if \('projectId' in fields\) \{[\s\S]{0,200}await releaseOldProjectLinks\(tx, ctx\.tenantId, ctx\.userId, \[id, \.\.\.others\]/);
    });
});
