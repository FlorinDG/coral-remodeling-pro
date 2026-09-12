import type { Page } from '@/components/admin/database/types';

/**
 * Single source of truth for task containment (subtasks).
 * Invariant: Every surface that shows tasks reads parent/subtask relationships
 * through this module. No surface implements its own check.
 */

export const PROP_TASK_PARENT = 'prop-task-parent';

/**
 * Extracts parent task id from a page's properties if present.
 * Handles relation format (array of ids or single string id).
 */
export function getParentTaskId(task: Page): string | null {
    if (!task || !task.properties) return null;
    const parent = task.properties[PROP_TASK_PARENT];
    if (Array.isArray(parent) && parent.length > 0) {
        const id = String(parent[0]).trim();
        return id.length > 0 ? id : null;
    }
    if (typeof parent === 'string') {
        const id = parent.trim();
        return id.length > 0 ? id : null;
    }
    return null;
}

/**
 * Returns true if the task is a child of another task.
 */
export function isSubtask(task: Page): boolean {
    return Boolean(getParentTaskId(task));
}

/**
 * Returns direct subtasks of a given parent task id.
 */
export function subtasksOf(parentId: string, all: Page[]): Page[] {
    if (!parentId || !Array.isArray(all)) return [];
    return all.filter(p => getParentTaskId(p) === parentId);
}

/**
 * Filters a page list to only root/top-level tasks (excludes anything with a parent).
 */
export function topLevel(all: Page[]): Page[] {
    if (!Array.isArray(all)) return [];
    return all.filter(p => !isSubtask(p));
}

/**
 * Checks if a task is marked complete.
 * Supports both canonical 'opt-done' (Tasks module) and project 't-done' (TS-1 invariant).
 */
export function isTaskCompleted(task: Page): boolean {
    if (!task || !task.properties) return false;
    const s = String(task.properties['prop-task-status'] || '');
    return s === 'opt-done' || s === 't-done';
}

/**
 * Computes subtask progress { done, total } for a parent task.
 */
export function subtaskProgress(parentId: string, all: Page[]): { done: number; total: number } {
    const subs = subtasksOf(parentId, all);
    const done = subs.filter(isTaskCompleted).length;
    return {
        done,
        total: subs.length,
    };
}

/**
 * Finds the parent task page for a subtask from the list of all pages.
 */
export function parentOf(task: Page, all: Page[]): Page | undefined {
    const parentId = getParentTaskId(task);
    if (!parentId || !Array.isArray(all)) return undefined;
    return all.find(p => p.id === parentId);
}

/**
 * Enforces one-level hierarchy:
 * A subtask cannot have subtasks.
 */
export function canHaveSubtasks(task: Page): boolean {
    return !isSubtask(task);
}

/**
 * Checks if a candidate task can be made a subtask of target parent:
 * 1. Target parent cannot be a subtask itself (1-level limit).
 * 2. Candidate cannot be the same as target parent (no self-reference).
 * 3. Candidate cannot already have subtasks of its own (would create 2 levels).
 */
export function canBeSubtask(candidate: Page, targetParentId: string, all: Page[]): boolean {
    if (!candidate || candidate.id === targetParentId) return false;
    const targetParent = all.find(p => p.id === targetParentId);
    if (!targetParent || isSubtask(targetParent)) return false;
    const existingChildren = subtasksOf(candidate.id, all);
    if (existingChildren.length > 0) return false;
    return true;
}

/**
 * Derives project for a task:
 * Subtasks DO NOT store prop-task-project — they dynamically derive it from their parent.
 * Top-level tasks return their own stored prop-task-project.
 */
export function getEffectiveProjectId(task: Page, all: Page[]): string | undefined {
    if (!task) return undefined;
    if (isSubtask(task)) {
        const parent = parentOf(task, all);
        if (!parent || !parent.properties) return undefined;
        const parentProj = parent.properties['prop-task-project'];
        if (Array.isArray(parentProj) && parentProj.length > 0) return String(parentProj[0]);
        if (typeof parentProj === 'string' && parentProj.length > 0) return parentProj;
        return undefined;
    }
    const proj = task.properties?.['prop-task-project'];
    if (Array.isArray(proj) && proj.length > 0) return String(proj[0]);
    if (typeof proj === 'string' && proj.length > 0) return proj;
    return undefined;
}
