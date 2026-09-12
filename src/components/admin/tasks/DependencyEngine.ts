import type { Page } from '@/components/admin/database/types';

export interface CycleValidationResult {
    ok: boolean;
    reason?: string;
    path?: string[];
}

export interface TaskDependencies {
    prerequisites: Page[];
    danglingPrerequisiteIds: string[];
    isBlocked: boolean;
    openPrerequisites: Page[];
    hasMissingBlocker: boolean;
}

function getTaskTitle(page: Page | undefined, fallbackId: string): string {
    if (!page) return `Task [${fallbackId}]`;
    const title = page.properties['title'];
    return (typeof title === 'string' && title.trim()) ? title.trim() : `Task [${page.id}]`;
}

function isTaskCompleted(page: Page): boolean {
    const status = page.properties['prop-task-status'] as string | undefined;
    return status === 'opt-done' || status === 't-done';
}

/**
 * Validates whether adding a dependency (targetTaskId depends on prerequisiteTaskId)
 * would create a circular dependency.
 *
 * Refuses self-dependencies and returns the exact named cycle path if detected.
 */
export function validateDependencyCycle(
    targetTaskId: string,
    prerequisiteTaskId: string,
    allPages: Page[]
): CycleValidationResult {
    const pageMap = new Map<string, Page>(allPages.map(p => [p.id, p]));
    const targetPage = pageMap.get(targetTaskId);
    const prereqPage = pageMap.get(prerequisiteTaskId);

    const targetTitle = getTaskTitle(targetPage, targetTaskId);
    const prereqTitle = getTaskTitle(prereqPage, prerequisiteTaskId);

    // Self-dependency check
    if (targetTaskId === prerequisiteTaskId) {
        return {
            ok: false,
            reason: `Cannot add dependency: "${targetTitle}" cannot depend on itself.`,
            path: [targetTitle, targetTitle],
        };
    }

    // DFS to check if prerequisiteTaskId already reaches targetTaskId through its dependency chain
    const visited = new Set<string>();
    const currentPath: string[] = [targetTitle, prereqTitle];

    function dfs(currentId: string): boolean {
        if (currentId === targetTaskId) {
            return true; // Cycle detected!
        }
        if (visited.has(currentId)) {
            return false;
        }
        visited.add(currentId);

        const currentTask = pageMap.get(currentId);
        if (!currentTask) return false;

        const deps = (currentTask.properties['prop-task-depends-on'] as string[] | undefined) || [];
        for (const nextId of deps) {
            const nextTask = pageMap.get(nextId);
            const nextTitle = getTaskTitle(nextTask, nextId);
            currentPath.push(nextTitle);

            if (dfs(nextId)) {
                return true;
            }

            currentPath.pop();
        }

        return false;
    }

    if (dfs(prerequisiteTaskId)) {
        const pathStr = currentPath.join(' → ');
        return {
            ok: false,
            reason: `Cannot add dependency: circular dependency detected (${pathStr}).`,
            path: currentPath,
        };
    }

    return { ok: true };
}

/**
 * Resolves all prerequisites for a task and surfaces dangling (deleted) blockers
 * rather than silently dropping them.
 */
export function getTaskDependencies(task: Page, allPages: Page[]): TaskDependencies {
    const rawDeps = (task.properties['prop-task-depends-on'] as string[] | undefined) || [];
    const pageMap = new Map<string, Page>(allPages.map(p => [p.id, p]));

    const prerequisites: Page[] = [];
    const danglingPrerequisiteIds: string[] = [];

    for (const depId of rawDeps) {
        const found = pageMap.get(depId);
        if (found) {
            prerequisites.push(found);
        } else {
            danglingPrerequisiteIds.push(depId);
        }
    }

    const openPrerequisites = prerequisites.filter(p => !isTaskCompleted(p));
    const hasMissingBlocker = danglingPrerequisiteIds.length > 0;
    const isBlocked = openPrerequisites.length > 0 || hasMissingBlocker;

    return {
        prerequisites,
        danglingPrerequisiteIds,
        isBlocked,
        openPrerequisites,
        hasMissingBlocker,
    };
}

/**
 * Finds all active tasks that list the given taskId in their prop-task-depends-on.
 */
export function getTaskDependents(taskId: string, allPages: Page[]): Page[] {
    return allPages.filter(p => {
        const deps = p.properties['prop-task-depends-on'] as string[] | undefined;
        return Array.isArray(deps) && deps.includes(taskId);
    });
}
