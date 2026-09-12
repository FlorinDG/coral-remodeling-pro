import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateDependencyCycle,
    getTaskDependencies,
    getTaskDependents,
} from '../src/components/admin/tasks/DependencyEngine.ts';
import type { Page } from '../src/components/admin/database/types.ts';

function createMockPage(id: string, title: string, dependsOn: string[] = [], status = 'opt-todo'): Page {
    return {
        id,
        databaseId: 'db-tasks',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        properties: {
            title,
            'prop-task-status': status,
            'prop-task-depends-on': dependsOn,
        },
        blocks: [],
    };
}

describe('Task Dependencies — Option (a) Informational & Referential Integrity', () => {

    test('DEP-2: Refuses self-dependency A → A', () => {
        const pages = [createMockPage('task-a', 'Foundation pour')];
        const result = validateDependencyCycle('task-a', 'task-a', pages);

        assert.equal(result.ok, false);
        assert.match(result.reason || '', /cannot depend on itself/i);
    });

    test('DEP-2: Refuses direct cycle A → B → A with exact named path', () => {
        // task-b already depends on task-a
        const taskA = createMockPage('task-a', 'Procure steel');
        const taskB = createMockPage('task-b', 'Erect structure', ['task-a']);
        const pages = [taskA, taskB];

        // Attempting to make task-a depend on task-b would create: task-a → task-b → task-a
        const result = validateDependencyCycle('task-a', 'task-b', pages);

        assert.equal(result.ok, false);
        assert.match(result.reason || '', /circular dependency detected/i);
        assert.ok(result.path && result.path.length >= 3);
        assert.equal(result.path[0], 'Procure steel');
        assert.equal(result.path[1], 'Erect structure');
        assert.equal(result.path[2], 'Procure steel');
    });

    test('DEP-2: Refuses indirect cycle A → B → C → A', () => {
        // A depends on B, B depends on C
        const taskA = createMockPage('task-a', 'Task A', ['task-b']);
        const taskB = createMockPage('task-b', 'Task B', ['task-c']);
        const taskC = createMockPage('task-c', 'Task C', []);
        const pages = [taskA, taskB, taskC];

        // Attempting to make C depend on A creates C → A → B → C
        const result = validateDependencyCycle('task-c', 'task-a', pages);

        assert.equal(result.ok, false);
        assert.match(result.reason || '', /circular dependency detected/i);
        assert.deepEqual(result.path, ['Task C', 'Task A', 'Task B', 'Task C']);
    });

    test('DEP-2: Allows valid acyclic dependency (DAG)', () => {
        const taskA = createMockPage('task-a', 'Permit review');
        const taskB = createMockPage('task-b', 'Order windows');
        const pages = [taskA, taskB];

        const result = validateDependencyCycle('task-b', 'task-a', pages);
        assert.equal(result.ok, true);
    });

    test('DEP-1 / D-3: Referential integrity — deleted prerequisite is loudly reported, never silently dropped', () => {
        // task-c points to task-deleted which does not exist in pages
        const taskA = createMockPage('task-a', 'Foundation', [], 'opt-done');
        const taskB = createMockPage('task-b', 'Wall framing', ['task-a', 'task-deleted-prereq']);
        const pages = [taskA, taskB];

        const deps = getTaskDependencies(taskB, pages);

        // Found task-a
        assert.equal(deps.prerequisites.length, 1);
        assert.equal(deps.prerequisites[0].id, 'task-a');

        // Missing blocker is detected and surfaced
        assert.equal(deps.danglingPrerequisiteIds.length, 1);
        assert.equal(deps.danglingPrerequisiteIds[0], 'task-deleted-prereq');
        assert.equal(deps.hasMissingBlocker, true);
        assert.equal(deps.isBlocked, true); // Still considered blocked because blocker disappeared rather than completed
    });

    test('Option (a): Surfaces blocked state honestly without hiding or burying tasks', () => {
        const taskA = createMockPage('task-a', 'Plumbing rough-in', [], 'opt-todo');
        const taskB = createMockPage('task-b', 'Drywall closing', ['task-a'], 'opt-todo');
        const pages = [taskA, taskB];

        const deps = getTaskDependencies(taskB, pages);

        assert.equal(deps.isBlocked, true);
        assert.equal(deps.openPrerequisites.length, 1);
        assert.equal(deps.openPrerequisites[0].id, 'task-a');

        // When taskA completes, taskB becomes unblocked
        const completedTaskA = { ...taskA, properties: { ...taskA.properties, 'prop-task-status': 'opt-done' } };
        const updatedDeps = getTaskDependencies(taskB, [completedTaskA, taskB]);
        assert.equal(updatedDeps.isBlocked, false);
        assert.equal(updatedDeps.openPrerequisites.length, 0);
    });

    test('Reverse lookup: getTaskDependents finds all tasks unlocked by a blocker', () => {
        const blocker = createMockPage('task-blocker', 'Permit approval');
        const dep1 = createMockPage('task-dep-1', 'Site excavation', ['task-blocker']);
        const dep2 = createMockPage('task-dep-2', 'Order concrete', ['task-blocker']);
        const unrelated = createMockPage('task-unrelated', 'Office billing', []);
        const pages = [blocker, dep1, dep2, unrelated];

        const dependents = getTaskDependents('task-blocker', pages);
        assert.equal(dependents.length, 2);
        const depIds = dependents.map(d => d.id);
        assert.ok(depIds.includes('task-dep-1'));
        assert.ok(depIds.includes('task-dep-2'));
    });
});
