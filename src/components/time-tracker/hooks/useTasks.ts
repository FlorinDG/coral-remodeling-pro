import { useState, useCallback, useEffect } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';
import { createTaskPage } from '@/app/actions/tasks';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Task {
    id: string;
    /** GlobalPage ID of the linked project in db-tasks (prop-task-project relation) */
    projectId: string | null;
    title: string;
    description: string | null;
    /** ERP task status option ID, e.g. 'opt-todo', 'opt-in-prog', 'opt-done'.
     *  Only management can change this via the admin Task Module. */
    status: string;
    /** Priority option ID, e.g. 'opt-low', 'opt-med', 'opt-high' */
    priority: string | null;
    createdAt: string;
    updatedAt: string;
    /** Raw properties from db-tasks GlobalPage */
    properties?: Record<string, unknown>;
    /** User IDs the task is assigned to (GlobalPage.assignedTo) */
    assignedTo?: string[];
    // Legacy alias for older consumers
    project_id?: string | null;
}

/** Checklist item added by a worker within a shift assignment.
 *  Stored as JSON array on ShiftTask.subtasks.
 *  NOT the same as task dependencies in db-tasks. */
export interface ShiftSubTask {
    id: string;
    title: string;
    done: boolean;
    doneAt: string | null;
    doneBy: string | null;
}

export interface ShiftTask {
    id: string;
    shiftId: string;
    taskId: string;
    /** Worker-reported progress status for this shift assignment.
     *  Values: 'pending' | 'in_progress' | 'done_by_worker'
     *  This is SEPARATE from the underlying db-tasks page status,
     *  which only management can change to 'officially done'. */
    status: string;
    completedBy: string | null;
    completedAt: string | null;
    createdAt: string;
    /** Checklist items added by the worker for this specific shift assignment */
    subtasks: ShiftSubTask[];
    /** Worker notes for this shift assignment */
    workerNotes: string | null;
    /** Hydrated task from db-tasks */
    task?: Task;
    // Legacy aliases
    shift_id?: string;
    task_id?: string;
}

// ─── useTasks ─────────────────────────────────────────────────────────────────

/** Fetches tasks from db-tasks, optionally filtered by project.
 *  Scope is enforced server-side (ASSIGNED_AND_OWN for workforce roles). */
export function useTasks(projectId?: string | null) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const data = await hrList<{
                id: string;
                name: string;
                properties: Record<string, unknown>;
                projectId: string | null;
                status: string;
                priority: string;
                assignedTo: string[];
            }>('erp-tasks');

            const filtered = data.filter(t => {
                // projectId filter: prop-task-project is a relation (string[])
                if (!projectId) return true;
                const relArr = t.properties['prop-task-project'] as string[] | undefined;
                return Array.isArray(relArr) ? relArr.includes(projectId) : t.projectId === projectId;
            }).map(t => ({
                id: t.id,
                projectId: t.projectId,
                title: t.name,
                description: null,
                status: t.status,
                priority: t.priority,
                createdAt: (t as any).createdAt || '',
                updatedAt: (t as any).createdAt || '',
                properties: t.properties,
                assignedTo: t.assignedTo,
                project_id: t.projectId,
            }));

            setTasks(filtered);
        } catch (err) {
            console.error('[useTasks] Failed to fetch tasks:', err);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const createTask = useCallback(async (data: Partial<Task> & { project_id?: string }) => {
        try {
            const page = await createTaskPage({
                title: data.title || 'Untitled Task',
                priority: data.priority || undefined,
                projectId: data.project_id || data.projectId || undefined,
            });

            const newTask: Task = {
                id: page.id,
                projectId: data.project_id || data.projectId || null,
                title: data.title || 'Untitled Task',
                description: null,
                status: 'opt-todo',
                priority: data.priority || 'opt-low',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                project_id: data.project_id || data.projectId || null,
            };

            // Optimistic update — add locally, then re-fetch for consistency
            setTasks(prev => [newTask, ...prev]);
            setTimeout(fetchTasks, 1500);

            return { data: newTask, error: null };
        } catch (err: any) {
            console.error('[useTasks] Failed to create task:', err);
            return { data: null, error: err?.message || 'Failed to create task' };
        }
    }, [fetchTasks]);

    return { tasks, loading, createTask, refetch: fetchTasks };
}

// ─── useShiftTasks ────────────────────────────────────────────────────────────

/** Manages the task assignments for a specific shift.
 *
 *  Architecture:
 *  - ShiftTask.status  = worker-reported progress ('pending' | 'in_progress' | 'done_by_worker')
 *  - ShiftTask.subtasks = JSON checklist items the worker adds for this shift
 *  - db-tasks page status = ERP status, only management can change this
 *
 *  Completing a shift task does NOT close the db-tasks page.
 *  That requires a management confirmation in the admin Task Module. */
export function useShiftTasks(shiftId?: string | null) {
    const [shiftTasks, setShiftTasks] = useState<ShiftTask[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchShiftTasks = useCallback(async () => {
        if (!shiftId) {
            setShiftTasks([]);
            return;
        }
        setLoading(true);
        try {
            const data = await hrList<ShiftTask>('shift-tasks', { shiftId });

            // Hydrate task details from erp-tasks in a single batch call
            const allErpTasks = await hrList<{ id: string; name: string; priority: string; status: string }>('erp-tasks').catch(() => []);
            const taskMap = new Map(allErpTasks.map(t => [t.id, t]));

            const enriched = data.map(st => ({
                ...st,
                shift_id: st.shiftId,
                task_id: st.taskId,
                subtasks: st.subtasks || [],
                workerNotes: st.workerNotes || null,
                task: taskMap.has(st.taskId) ? {
                    id: st.taskId,
                    projectId: null,
                    title: taskMap.get(st.taskId)!.name,
                    description: null,
                    status: taskMap.get(st.taskId)!.status,
                    priority: taskMap.get(st.taskId)!.priority,
                    createdAt: '',
                    updatedAt: '',
                } : undefined,
            }));

            setShiftTasks(enriched);
        } catch (err) {
            console.error('[useShiftTasks] Failed to fetch shift tasks:', err);
        } finally {
            setLoading(false);
        }
    }, [shiftId]);

    useEffect(() => {
        fetchShiftTasks();
    }, [fetchShiftTasks]);

    /** Assign an existing db-tasks task to this shift */
    const assignTask = useCallback(async (taskId: string) => {
        if (!shiftId) return;
        const res = await hrCreate<ShiftTask>('shift-tasks', {
            shiftId,
            taskId,
            status: 'pending',
            subtasks: [],
            workerNotes: null,
        });
        setShiftTasks(prev => [...prev, { ...res, subtasks: res.subtasks || [], workerNotes: res.workerNotes || null }]);
        return res;
    }, [shiftId]);

    /** Remove a task assignment from this shift */
    const removeTask = useCallback(async (shiftTaskId: string) => {
        await hrDelete('shift-tasks', shiftTaskId);
        setShiftTasks(prev => prev.filter(st => st.id !== shiftTaskId));
    }, []);

    /** Worker reports their work on this shift task as done.
     *  Sets ShiftTask.status = 'done_by_worker'.
     *  Does NOT update the underlying db-tasks page status.
     *  Management confirms the actual task closure in the admin Task Module. */
    const completeShiftTask = useCallback(async (shiftTaskId: string, completedBy?: string) => {
        await hrUpdate('shift-tasks', shiftTaskId, {
            status: 'done_by_worker',
            completedAt: new Date().toISOString(),
            completedBy: completedBy || null,
        });
        setShiftTasks(prev => prev.map(st =>
            st.id === shiftTaskId
                ? { ...st, status: 'done_by_worker', completedAt: new Date().toISOString() }
                : st
        ));
    }, []);

    /** Worker marks a shift task as in-progress */
    const startShiftTask = useCallback(async (shiftTaskId: string) => {
        await hrUpdate('shift-tasks', shiftTaskId, { status: 'in_progress' });
        setShiftTasks(prev => prev.map(st =>
            st.id === shiftTaskId ? { ...st, status: 'in_progress' } : st
        ));
    }, []);

    /** Add a subtask checklist item to a shift task assignment */
    const addSubTask = useCallback(async (shiftTaskId: string, title: string) => {
        const shiftTask = shiftTasks.find(st => st.id === shiftTaskId);
        if (!shiftTask) return;

        const newSubTask: ShiftSubTask = {
            id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            done: false,
            doneAt: null,
            doneBy: null,
        };

        const updatedSubtasks = [...(shiftTask.subtasks || []), newSubTask];
        await hrUpdate('shift-tasks', shiftTaskId, { subtasks: updatedSubtasks });
        setShiftTasks(prev => prev.map(st =>
            st.id === shiftTaskId ? { ...st, subtasks: updatedSubtasks } : st
        ));
    }, [shiftTasks]);

    /** Toggle a subtask checklist item done/undone */
    const toggleSubTask = useCallback(async (shiftTaskId: string, subTaskId: string, doneBy?: string) => {
        const shiftTask = shiftTasks.find(st => st.id === shiftTaskId);
        if (!shiftTask) return;

        const updatedSubtasks = (shiftTask.subtasks || []).map(sub =>
            sub.id === subTaskId
                ? {
                    ...sub,
                    done: !sub.done,
                    doneAt: !sub.done ? new Date().toISOString() : null,
                    doneBy: !sub.done ? (doneBy || null) : null,
                }
                : sub
        );

        await hrUpdate('shift-tasks', shiftTaskId, { subtasks: updatedSubtasks });
        setShiftTasks(prev => prev.map(st =>
            st.id === shiftTaskId ? { ...st, subtasks: updatedSubtasks } : st
        ));
    }, [shiftTasks]);

    /** Update worker notes on a shift task */
    const updateWorkerNotes = useCallback(async (shiftTaskId: string, notes: string) => {
        await hrUpdate('shift-tasks', shiftTaskId, { workerNotes: notes });
        setShiftTasks(prev => prev.map(st =>
            st.id === shiftTaskId ? { ...st, workerNotes: notes } : st
        ));
    }, []);

    return {
        shiftTasks,
        loading,
        assignTask,
        removeTask,
        completeShiftTask,
        startShiftTask,
        addSubTask,
        toggleSubTask,
        updateWorkerNotes,
        refetch: fetchShiftTasks,
    };
}

// ─── useCompletedTasks ────────────────────────────────────────────────────────

export function useCompletedTasks() {
    const [completedTasks] = useState<(ShiftTask & { task?: Task })[]>([]);
    return { completedTasks, loading: false, refetch: async () => {} };
}
