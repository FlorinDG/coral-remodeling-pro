/**
 * Florin's preview test, 2026-10-10 — the shift editor:
 *  1. tasks "should be available even on shifts without project" (core: taskFitsShift);
 *  2. the order giver "disappears" when a project is chosen — and the edit dialog had none, so every edit erased it;
 *  3. files only from local storage — the tenant's files must be pickable;
 *  4. the recurring scheduler's week started on Sunday; the default must be 1 week, not 4.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { taskFitsShift, taskProjectIdsOf } from '../src/lib/records/shift-project-links.ts';
import { weekdaysMondayFirst } from '../src/lib/format/date.ts';

const D = 'src/components/time-tracker/components/schedule/shift-editor/';
const CREATE = readFileSync(D + 'CreateShiftForm.tsx', 'utf8');
const EDIT = readFileSync(D + 'EditShiftDialog.tsx', 'utf8');
const TASKS = readFileSync(D + 'components/ShiftTasksTab.tsx', 'utf8');
const FILES = readFileSync(D + 'components/ShiftAttachmentsTab.tsx', 'utf8');

describe('1 · tasks on a shift with or without a project', () => {
    test('the rule: the project\'s tasks; without a project, the tasks without one', () => {
        assert.equal(taskFitsShift(['p1'], 'p1'), true);
        assert.equal(taskFitsShift(['p2'], 'p1'), false);
        assert.equal(taskFitsShift([], 'p1'), false);
        assert.equal(taskFitsShift([], null), true);
        assert.equal(taskFitsShift(['p1'], null), false);
    });
    test('a task\'s projects are read from its relation (array or legacy single id)', () => {
        assert.deepEqual(taskProjectIdsOf({ 'prop-task-project': ['p1', '', 3] }), ['p1']);
        assert.deepEqual(taskProjectIdsOf({ 'prop-task-project': 'p1' }), ['p1']);
        assert.deepEqual(taskProjectIdsOf(null), []);
    });
    test('both task pickers use the rule and no longer stop at "select a project"', () => {
        for (const [name, s] of [['ShiftTasksTab', TASKS], ['CreateShiftForm', CREATE]] as const) {
            assert.match(s, /taskFitsShift\(taskProjectIdsOf\(task\.properties\)/, name);
            assert.doesNotMatch(s, /tasks\.selectProject'\)|<p className="text-sm">\{t\('selectProject'\)\}<\/p>/, name);
            assert.match(s, /projectId: projectId \|\| undefined/, `${name}: a quick task without a project`);
        }
    });
});

describe('2 · the order giver on every shift', () => {
    test('create and edit both render the one field; with a project it reads "the project\'s client"', () => {
        assert.match(CREATE, /<OrderGiverField value=\{contactPageId\} onChange=\{setContactPageId\} hasProject=\{!!projectId\} \/>/);
        assert.doesNotMatch(CREATE, /!projectId && clients\.length > 0/);
        assert.match(EDIT, /<OrderGiverField value=\{contactPageId\} onChange=\{setContactPageId\} hasProject=\{!!projectId\} \/>/);
    });
    test('an edit keeps the order giver (loaded and sent back — it was sent as null)', () => {
        assert.match(EDIT, /setContactPageId\(\(s as \{ contactPageId\?: string \| null \}\)\.contactPageId \|\| ''\)/);
        assert.match(EDIT, /contactPageId: contactPageId \|\| null,/);
    });
});

describe('3 · the tenant\'s files are pickable', () => {
    test('both attachment lists offer the tenant file picker, through the gated door', () => {
        assert.match(FILES, /<TenantFilePicker onPick=\{handleAddStored\}/);
        assert.match(CREATE, /<TenantFilePicker onPick=\{addStoredFile\}/);
        assert.match(readFileSync('src/components/shared/TenantFilePicker.tsx', 'utf8'), /await listAllTenantFiles\(\)/);
    });
});

describe('4 · the recurring scheduler', () => {
    test('Monday first, labels in the user\'s language, the kernel\'s day numbers', () => {
        const w = weekdaysMondayFirst('nl');
        assert.deepEqual(w.map(d => d.day), [1, 2, 3, 4, 5, 6, 0]);
        assert.match(w[0].label.toLowerCase(), /^ma/);
        assert.match(w[6].label.toLowerCase(), /^zo/);
        assert.match(weekdaysMondayFirst('en')[0].label, /^Mon/);
    });
    test('both dialogs render that order and default to ONE week', () => {
        for (const [name, s] of [['create', CREATE], ['edit', EDIT]] as const) {
            assert.match(s, /weekdaysMondayFirst\(locale\)/, name);
            assert.match(s, /useState\(1\);   \/\/ Florin 2026-10-10: one week by default/, name);
            assert.doesNotMatch(s, /useState\(4\)|setRecurringWeeks\(4\)/, name);
        }
    });
});
