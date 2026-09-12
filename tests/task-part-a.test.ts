import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from '../src/components/admin/database/types.ts';

// Replicate the ownership logic tested on mobile
function isMyTask(p: Page, currentUserId?: string): boolean {
    const assignee = p.properties['prop-task-assignee'];
    if (!assignee) return true;
    if (Array.isArray(assignee)) {
        if (assignee.length === 0) return true;
        return Boolean(currentUserId && assignee.includes(currentUserId));
    }
    if (typeof assignee === 'string') {
        if (!assignee.trim()) return true;
        return Boolean(currentUserId && assignee === currentUserId);
    }
    return true;
}

function isDoneTask(p: Page): boolean {
    const status = p.properties['prop-task-status'];
    return status === 'opt-done';
}

function isClosedTask(p: Page): boolean {
    const status = p.properties['prop-task-status'];
    return status === 'opt-done' || status === 'opt-dropped';
}

function createMockTask(opts: {
    id: string;
    title: string;
    assignee?: string[] | string;
    project?: string[];
    status?: string;
}): Page {
    return {
        id: opts.id,
        databaseId: 'db-tasks',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        properties: {
            title: opts.title,
            'prop-task-assignee': opts.assignee,
            'prop-task-project': opts.project,
            'prop-task-status': opts.status || 'opt-todo',
        },
        blocks: [],
    };
}

describe('Tasks Part A — Ownership & Scope Invariants', () => {

    test('TASK-M1: Unassigned task without a project is in My Tasks', () => {
        const task = createMockTask({ id: 't1', title: 'Buy nails' });
        assert.equal(isMyTask(task, 'user-florin'), true);
    });

    test('TASK-M1 & TASK-M10: Task assigned to a project REMAINS in My Tasks (no project trap)', () => {
        const task = createMockTask({
            id: 't2',
            title: 'Install tiles',
            project: ['proj-bath-remodel'],
        });

        // Crucial invariant: assigning a project does NOT filter the task out of My Tasks!
        assert.equal(isMyTask(task, 'user-florin'), true);
    });

    test('TASK-M1: Task assigned to current user is in My Tasks', () => {
        const task = createMockTask({
            id: 't3',
            title: 'Review invoice',
            assignee: ['user-florin'],
            project: ['proj-office'],
        });
        assert.equal(isMyTask(task, 'user-florin'), true);
    });

    test('TASK-M1: Task assigned to another user is NOT in My Tasks', () => {
        const task = createMockTask({
            id: 't4',
            title: 'Paint wall',
            assignee: ['user-alex'],
            project: ['proj-bath-remodel'],
        });
        assert.equal(isMyTask(task, 'user-florin'), false);
    });

    test('Canonical Status: Recognizes opt-done as complete and opt-dropped as closed', () => {
        const taskOptDone = createMockTask({ id: 't5', title: 'Done task', status: 'opt-done' });
        const taskTodo = createMockTask({ id: 't7', title: 'Open task', status: 'opt-todo' });
        const taskDropped = createMockTask({ id: 't8', title: 'Dropped', status: 'opt-dropped' });

        assert.equal(isDoneTask(taskOptDone), true);
        assert.equal(isDoneTask(taskTodo), false);

        assert.equal(isClosedTask(taskOptDone), true);
        assert.equal(isClosedTask(taskDropped), true);
        assert.equal(isClosedTask(taskTodo), false);
    });
});
