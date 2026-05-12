import { useState, useCallback, useEffect } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';

export interface Task {
  id: string;
  projectId: string; // From GlobalPage
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
  // Legacy aliases
  project_id?: string;
}

export interface ShiftTask {
  id: string;
  shiftId: string;
  taskId: string;
  status: string;
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  task?: Task;
  // Legacy aliases
  shift_id?: string;
  task_id?: string;
}

export function useTasks(projectId?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      const data = await hrList<{ id: string; name: string, properties: any }>('erp-tasks');
      // Filter by project relation if possible, or just return all for this project
      // For now, assuming db-tasks pages might have a relation to db-projects
      // But if we don't have the relation ID, we just show all tasks for the tenant
      // Or we can filter client-side if the property exists
      const filtered = data.filter(p => {
        const props = p.properties || {};
        const rel = props['prop-project-relation'] || props['project'] || props['projectId'];
        return !projectId || rel === projectId;
      }).map(p => ({
        id: p.id,
        projectId: projectId || '',
        title: p.name,
        description: null,
        status: (p.properties as any)?.status || 'todo',
        priority: (p.properties as any)?.priority || 'normal',
        createdAt: (p as any).createdAt,
        updatedAt: (p as any).createdAt,
        project_id: projectId || '',
      }));
      setTasks(filtered);
    } catch (err) {
      console.error('Failed to fetch ERP tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (data: Partial<Task>) => {
    // This would ideally create a GlobalPage in db-tasks
    // For now, we skip or implement if needed
    return { data: null, error: 'Creation via scheduler not yet supported' };
  }, []);

  return { tasks, loading, createTask, refetch: fetchTasks };
}

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
      // Fetch task details for each shift-task
      const tasksData = await hrList<{ id: string; name: string }>('erp-tasks');
      const taskMap = new Map(tasksData.map(t => [t.id, t]));

      const enriched = data.map(st => ({
        ...st,
        shift_id: st.shiftId,
        task_id: st.taskId,
        task: taskMap.has(st.taskId) ? {
          id: st.taskId,
          title: taskMap.get(st.taskId)!.name,
        } as any : undefined
      }));
      setShiftTasks(enriched);
    } catch (err) {
      console.error('Failed to fetch shift tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    fetchShiftTasks();
  }, [fetchShiftTasks]);

  const assignTask = useCallback(async (taskId: string) => {
    if (!shiftId) return;
    try {
      const res = await hrCreate('shift-tasks', { shiftId, taskId, status: 'pending' });
      setShiftTasks(prev => [...prev, res]);
      return res;
    } catch (err) {
      throw err;
    }
  }, [shiftId]);

  const removeTask = useCallback(async (id: string) => {
    try {
      await hrDelete('shift-tasks', id);
      setShiftTasks(prev => prev.filter(st => st.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const completeShiftTask = useCallback(async (id: string) => {
    try {
      await hrUpdate('shift-tasks', id, { status: 'completed', completedAt: new Date().toISOString() });
      setShiftTasks(prev => prev.map(st => st.id === id ? { ...st, status: 'completed' } : st));
    } catch (err) {
      throw err;
    }
  }, []);

  return { shiftTasks, loading, assignTask, removeTask, completeShiftTask, refetch: fetchShiftTasks };
}

export function useCompletedTasks() {
  const [completedTasks] = useState<(ShiftTask & { task?: Task })[]>([]);
  return { completedTasks, loading: false, refetch: async () => {} };
}
