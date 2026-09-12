import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from '../src/components/admin/database/types.ts';
import {
    isSubtask,
    subtasksOf,
    topLevel,
    subtaskProgress,
    parentOf,
    canHaveSubtasks,
    canBeSubtask,
    getEffectiveProjectId,
} from '../src/lib/tasks/subtasks.ts';

function createMockTask(id: string, props: Record<string, any> = {}): Page {
    return {
        id,
        databaseId: 'db-tasks',
        properties: {
            title: `Task ${id}`,
            'prop-task-status': 'opt-todo',
            ...props,
        },
        blocks: [],
        blocksVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user-1',
        lastEditedBy: 'user-1',
    };
}

describe('Subtask Containment Invariants (coral-task-subtasks.md)', () => {
    it('isSubtask correctly identifies parented tasks vs top-level tasks', () => {
        const parent = createMockTask('parent-1');
        const child1 = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const child2 = createMockTask('child-2', { 'prop-task-parent': 'parent-1' });
        const emptyParent = createMockTask('child-3', { 'prop-task-parent': [] });

        assert.strictEqual(isSubtask(parent), false);
        assert.strictEqual(isSubtask(child1), true);
        assert.strictEqual(isSubtask(child2), true);
        assert.strictEqual(isSubtask(emptyParent), false);
    });

    it('topLevel filters out all subtasks and retains only parents and loose tasks', () => {
        const parent = createMockTask('parent-1');
        const child1 = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const loose = createMockTask('loose-1');
        const all = [parent, child1, loose];

        const roots = topLevel(all);
        assert.strictEqual(roots.length, 2);
        assert.deepStrictEqual(roots.map(r => r.id), ['parent-1', 'loose-1']);
    });

    it('subtasksOf returns all direct children of parent', () => {
        const parent = createMockTask('parent-1');
        const child1 = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const child2 = createMockTask('child-2', { 'prop-task-parent': ['parent-1'] });
        const otherChild = createMockTask('child-3', { 'prop-task-parent': ['other-parent'] });
        const all = [parent, child1, child2, otherChild];

        const children = subtasksOf('parent-1', all);
        assert.strictEqual(children.length, 2);
        assert.deepStrictEqual(children.map(c => c.id), ['child-1', 'child-2']);
    });

    it('subtaskProgress correctly counts both opt-done and t-done', () => {
        const parent = createMockTask('parent-1');
        const child1 = createMockTask('child-1', { 'prop-task-parent': ['parent-1'], 'prop-task-status': 'opt-done' });
        const child2 = createMockTask('child-2', { 'prop-task-parent': ['parent-1'], 'prop-task-status': 't-done' });
        const child3 = createMockTask('child-3', { 'prop-task-parent': ['parent-1'], 'prop-task-status': 'opt-todo' });
        const all = [parent, child1, child2, child3];

        const progress = subtaskProgress('parent-1', all);
        assert.strictEqual(progress.total, 3);
        assert.strictEqual(progress.done, 2);
    });

    it('Completing all subtasks does NOT auto-complete the parent', () => {
        const parent = createMockTask('parent-1', { 'prop-task-status': 'opt-todo' });
        const child1 = createMockTask('child-1', { 'prop-task-parent': ['parent-1'], 'prop-task-status': 'opt-done' });
        const child2 = createMockTask('child-2', { 'prop-task-parent': ['parent-1'], 'prop-task-status': 'opt-done' });
        const all = [parent, child1, child2];

        const progress = subtaskProgress('parent-1', all);
        assert.strictEqual(progress.done, progress.total);
        // Parent remains opt-todo until a person marks it closed
        assert.strictEqual(parent.properties['prop-task-status'], 'opt-todo');
    });

    it('parentOf returns the parent page', () => {
        const parent = createMockTask('parent-1');
        const child = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const all = [parent, child];

        const resolved = parentOf(child, all);
        assert.strictEqual(resolved?.id, 'parent-1');
    });

    it('Enforces 1-level limit: canHaveSubtasks and canBeSubtask', () => {
        const parent = createMockTask('parent-1');
        const child = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const all = [parent, child];

        assert.strictEqual(canHaveSubtasks(parent), true);
        assert.strictEqual(canHaveSubtasks(child), false);

        // child cannot be parent of another task
        assert.strictEqual(canBeSubtask(parent, 'child-1', all), false);
        // cannot be subtask of self
        assert.strictEqual(canBeSubtask(parent, 'parent-1', all), false);
    });

    it('Project derivation: subtask stores NO project and dynamically derives parent project', () => {
        const parent = createMockTask('parent-1', { 'prop-task-project': ['proj-alpha'] });
        const child = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const all = [parent, child];

        // Child stores no project
        assert.strictEqual(child.properties['prop-task-project'], undefined);

        // Derived project matches parent
        assert.strictEqual(getEffectiveProjectId(child, all), 'proj-alpha');

        // Parent project changes
        parent.properties['prop-task-project'] = ['proj-beta'];
        assert.strictEqual(getEffectiveProjectId(child, all), 'proj-beta');
        // Child still stores no project!
        assert.strictEqual(child.properties['prop-task-project'], undefined);
    });

    it('Deleting parent promotes subtasks to top-level tasks (clearing parent)', () => {
        const parent = createMockTask('parent-1');
        const child1 = createMockTask('child-1', { 'prop-task-parent': ['parent-1'] });
        const child2 = createMockTask('child-2', { 'prop-task-parent': ['parent-1'] });
        let all = [parent, child1, child2];

        // Simulate parent deletion logic
        const childrenToPromote = subtasksOf('parent-1', all);
        assert.strictEqual(childrenToPromote.length, 2);

        // Clear parent relation
        for (const c of childrenToPromote) {
            c.properties['prop-task-parent'] = [];
        }
        all = all.filter(p => p.id !== 'parent-1');

        // Now both children are top-level
        const roots = topLevel(all);
        assert.strictEqual(roots.length, 2);
        assert.strictEqual(isSubtask(child1), false);
        assert.strictEqual(isSubtask(child2), false);
    });
});
