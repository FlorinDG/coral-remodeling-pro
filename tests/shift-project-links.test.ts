/**
 * SHIFT-PROJ-1 (Florin 2026-10-10): "when changing project on a shift, the old project tasks and files persist."
 * The old project's task assignments and project-file links leave with it, in the same transaction as the move.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linksLeavingProject, isProjectFileUrl } from '../src/lib/records/shift-project-links.ts';
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

describe('SHIFT-PROJ-1 · the door', () => {
    function fakeTx() {
        const deleted = { shiftTask: [] as string[], shiftAttachment: [] as string[] };
        const tx = {
            scheduledShift: { findMany: async () => [{ id: 's1', projectId: 'p-old' }, { id: 's2', projectId: 'p-new' }] },
            shiftTask: {
                findMany: async () => [{ id: 'l-old', shiftId: 's1', taskId: 'task-a' }, { id: 'l-keep', shiftId: 's2', taskId: 'task-a' }],
                deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { deleted.shiftTask.push(...where.id.in); return { count: where.id.in.length }; },
            },
            shiftAttachment: {
                findMany: async () => [{ id: 'f-old', shiftId: 's1', url: fileOf('p-old', 'plan.pdf') }],
                deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { deleted.shiftAttachment.push(...where.id.in); return { count: where.id.in.length }; },
            },
            globalPage: { findMany: async () => [{ id: 'task-a', properties: { 'prop-task-project': ['p-old'] } }] },
        };
        return { tx, deleted };
    }
    test('only the shifts that change project lose links; the deletes name exactly those links', async () => {
        const { tx, deleted } = fakeTx();
        const n = await releaseOldProjectLinks(tx as never, T, ['s1', 's2'], 'p-new');
        assert.deepEqual(n, { tasks: 1, files: 1 });
        assert.deepEqual(deleted, { shiftTask: ['l-old'], shiftAttachment: ['f-old'] });
    });
});

describe('SHIFT-PROJ-1 · the route', () => {
    const ROUTE = readFileSync('src/app/api/hr/[entity]/route.ts', 'utf8');
    test('a single shift and a series release the old links inside the transaction that moves them', () => {
        assert.match(ROUTE, /await releaseOldProjectLinks\(tx, ctx\.tenantId, \[id\], \(data\.projectId as string \| null\) \|\| null\);\s*return tx\.scheduledShift\.update/);
        assert.match(ROUTE, /if \('projectId' in fields\) \{[\s\S]{0,200}await releaseOldProjectLinks\(tx, ctx\.tenantId, \[id, \.\.\.others\]/);
    });
});
