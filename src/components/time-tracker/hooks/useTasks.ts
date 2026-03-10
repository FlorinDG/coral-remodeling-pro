"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  created_by: string | null;
  completed_by: string | null;
  project?: { name: string; color: string };
}

export interface ShiftTask {
  id: string;
  shift_id: string;
  task_id: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  task?: Task;
}

export function useTasks(projectId?: string | null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    let query = supabase
      .from('tasks')
      .select('*, project:projects(name, color)')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    setTasks(data || []);
  }, [user, projectId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchTasks();
      setLoading(false);
    };
    if (user) {
      load();
    }
  }, [user, fetchTasks]);

  const createTask = async (task: {
    project_id: string;
    title: string;
    description?: string | null;
    priority?: string | null;
  }) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...task,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    await fetchTasks();
    return data;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    await fetchTasks();
  };

  const completeTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error completing task:', error);
      throw error;
    }

    await fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }

    await fetchTasks();
  };

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    refetch: fetchTasks,
  };
}

export function useShiftTasks(shiftId?: string | null) {
  const { user } = useAuth();
  const [shiftTasks, setShiftTasks] = useState<ShiftTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShiftTasks = useCallback(async () => {
    if (!user || !shiftId) {
      setShiftTasks([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('shift_tasks')
      .select('*, task:tasks(*, project:projects(name, color))')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching shift tasks:', error);
      return;
    }

    setShiftTasks(data || []);
  }, [user, shiftId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchShiftTasks();
      setLoading(false);
    };
    load();
  }, [fetchShiftTasks]);

  const assignTask = async (taskId: string) => {
    if (!shiftId) return;

    const { error } = await supabase
      .from('shift_tasks')
      .insert({
        shift_id: shiftId,
        task_id: taskId,
      });

    if (error) {
      console.error('Error assigning task:', error);
      throw error;
    }

    await fetchShiftTasks();
  };

  const removeTask = async (shiftTaskId: string) => {
    const { error } = await supabase
      .from('shift_tasks')
      .delete()
      .eq('id', shiftTaskId);

    if (error) {
      console.error('Error removing task:', error);
      throw error;
    }

    await fetchShiftTasks();
  };

  const completeShiftTask = async (shiftTaskId: string) => {
    const { error } = await supabase
      .from('shift_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
      })
      .eq('id', shiftTaskId);

    if (error) {
      console.error('Error completing shift task:', error);
      throw error;
    }

    await fetchShiftTasks();
  };

  return {
    shiftTasks,
    loading,
    assignTask,
    removeTask,
    completeShiftTask,
    refetch: fetchShiftTasks,
  };
}

export function useCompletedTasks() {
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<ShiftTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompletedTasks = useCallback(async () => {
    if (!user) return;

    // Fetch completed shift tasks for the current user's shifts
    const { data, error } = await supabase
      .from('shift_tasks')
      .select(`
        *,
        task:tasks(*, project:projects(name, color)),
        shift:scheduled_shifts!inner(user_id, shift_date)
      `)
      .eq('status', 'completed')
      .eq('shift.user_id', user.id)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Error fetching completed tasks:', error);
      return;
    }

    setCompletedTasks(data || []);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCompletedTasks();
      setLoading(false);
    };
    if (user) {
      load();
    }
  }, [user, fetchCompletedTasks]);

  return {
    completedTasks,
    loading,
    refetch: fetchCompletedTasks,
  };
}
