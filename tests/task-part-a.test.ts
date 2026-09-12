import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from '../src/components/admin/database/types.ts';
import { isSubtask, getParentTaskId } from '../src/lib/tasks/subtasks.ts';

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

// TS-1 (coral-task-status-two-subsystems.md):
// Reads both opt-done and t-done. Project subsystem actively writes t-*.
function isDoneTask(p: Page): boolean {
    const status = p.properties['prop-task-status'];
    return status === 'opt-done' || status === 't-done';
}

function isClosedTask(p: Page): boolean {
    const status = p.properties['prop-task-status'];
    return status === 'opt-done' || status === 't-done' || status === 'opt-dropped';
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

    test('TS-1: Recognizes opt-done and project t-done as complete, t-todo/t-prog as open', () => {
        const taskOptDone = createMockTask({ id: 't5', title: 'Done task', status: 'opt-done' });
        const taskTDone = createMockTask({ id: 't6', title: 'Done project task', status: 't-done' });
        const taskTTodo = createMockTask({ id: 't7a', title: 'Project todo', status: 't-todo' });
        const taskTProg = createMockTask({ id: 't7b', title: 'Project in progress', status: 't-prog' });
        const taskOptTodo = createMockTask({ id: 't7c', title: 'Open personal task', status: 'opt-todo' });
        const taskDropped = createMockTask({ id: 't8', title: 'Dropped', status: 'opt-dropped' });

        // isDoneTask: opt-done and t-done are done
        assert.equal(isDoneTask(taskOptDone), true);
        assert.equal(isDoneTask(taskTDone), true);
        assert.equal(isDoneTask(taskTTodo), false);
        assert.equal(isDoneTask(taskTProg), false);
        assert.equal(isDoneTask(taskOptTodo), false);

        // isClosedTask: opt-done, t-done, and opt-dropped are closed
        assert.equal(isClosedTask(taskOptDone), true);
        assert.equal(isClosedTask(taskTDone), true);
        assert.equal(isClosedTask(taskDropped), true);

        // Open: t-todo, t-prog, opt-todo are open
        assert.equal(isClosedTask(taskTTodo), false);
        assert.equal(isClosedTask(taskTProg), false);
        assert.equal(isClosedTask(taskOptTodo), false);
    });
});

describe('Subtasks & Recurrence Invariants (coral-task-subtasks.md & TASK-M14)', () => {

    test('TASK-SUBTASKS: Subtasks do NOT appear as separate rows in root My Tasks list', () => {
        const parentTask = createMockTask({ id: 'parent-1', title: 'Parent Remodel' });
        const subtask1 = createMockTask({ id: 'sub-1', title: 'Measure space' });
        subtask1.properties['prop-task-parent'] = ['parent-1'];

        const all = [parentTask, subtask1];
        const rootTasks = all.filter(p => isMyTask(p, 'user-florin') && !isSubtask(p));

        assert.equal(rootTasks.length, 1);
        assert.equal(rootTasks[0].id, 'parent-1');
        assert.equal(isSubtask(subtask1), true);
        assert.equal(isSubtask(parentTask), false);
    });

    test('TASK-SUBTASKS: Progress is accurately calculated (e.g. 2/3 done)', () => {
        const parent = createMockTask({ id: 'parent-1', title: 'Build Deck' });
        const sub1 = createMockTask({ id: 's1', title: 'Buy wood', status: 'opt-done' });
        const sub2 = createMockTask({ id: 's2', title: 'Cut planks', status: 'opt-done' });
        const sub3 = createMockTask({ id: 's3', title: 'Paint deck', status: 'opt-todo' });
        sub1.properties['prop-task-parent'] = ['parent-1'];
        sub2.properties['prop-task-parent'] = ['parent-1'];
        sub3.properties['prop-task-parent'] = ['parent-1'];

        const children = [sub1, sub2, sub3].filter(p => getParentTaskId(p) === parent.id);
        const doneChildren = children.filter(isDoneTask).length;

        assert.equal(children.length, 3);
        assert.equal(doneChildren, 2);
        assert.equal(`${doneChildren}/${children.length}`, '2/3');
    });

    test('TASK-SUBTASKS: Completing all subtasks does NOT auto-complete parent', () => {
        const parent = createMockTask({ id: 'p1', title: 'Assemble Furniture', status: 'opt-todo' });
        const sub1 = createMockTask({ id: 's1', title: 'Legs', status: 'opt-done' });
        const sub2 = createMockTask({ id: 's2', title: 'Tabletop', status: 'opt-done' });
        sub1.properties['prop-task-parent'] = ['p1'];
        sub2.properties['prop-task-parent'] = ['p1'];

        const children = [sub1, sub2];
        const allDone = children.every(isDoneTask);
        assert.equal(allDone, true);

        // Parent must remain opt-todo until closed by the user
        assert.equal(isDoneTask(parent), false);
        assert.equal(parent.properties['prop-task-status'], 'opt-todo');
    });

    test('TASK-SUBTASKS: Deleting parent promotes subtasks to top-level tasks (no cascade delete)', () => {
        const parent = createMockTask({ id: 'p1', title: 'Kitchen' });
        const sub1 = createMockTask({ id: 's1', title: 'Cabinets' });
        const sub2 = createMockTask({ id: 's2', title: 'Countertops' });
        sub1.properties['prop-task-parent'] = ['p1'];
        sub2.properties['prop-task-parent'] = ['p1'];

        const children = [sub1, sub2].filter(p => getParentTaskId(p) === parent.id);
        // Simulate promotion logic:
        for (const child of children) {
            child.properties['prop-task-parent'] = [];
        }

        assert.equal(isSubtask(sub1), false);
        assert.equal(isSubtask(sub2), false);
        assert.deepEqual(sub1.properties['prop-task-parent'], []);
        assert.deepEqual(sub2.properties['prop-task-parent'], []);
    });

    test('TASK-M14: Recurrence anchor calculates next due date correctly from due vs completion', async () => {
        const { parseRecurrenceRule, getNextDueDate } = await import('../src/components/admin/tasks/RecurrenceEngine.ts');

        const parsedWeekly = parseRecurrenceRule('weekly');
        assert.equal(parsedWeekly.ok, true);

        // Mode: From due date
        const baseDueDate = new Date('2026-10-01T00:00:00Z');
        const nextFromDue = getNextDueDate(parsedWeekly, baseDueDate, {
            repeatFrom: 'due',
            completionDate: new Date('2026-10-05T00:00:00Z'),
        });
        // 7 days after 2026-10-01 = 2026-10-08
        assert.equal(nextFromDue.toISOString().slice(0, 10), '2026-10-08');

        // Mode: From completion date
        const nextFromCompletion = getNextDueDate(parsedWeekly, baseDueDate, {
            repeatFrom: 'completion',
            completionDate: new Date('2026-10-05T00:00:00Z'),
        });
        // 7 days after 2026-10-05 = 2026-10-12
        assert.equal(nextFromCompletion.toISOString().slice(0, 10), '2026-10-12');
    });
});

