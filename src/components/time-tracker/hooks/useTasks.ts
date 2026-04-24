"use client";
import { useState, useEffect, useCallback } from 'react';

/**
 * Tasks — SCAFFOLD
 * Uses local state. Will be connected to the existing
 * CoralOS Tasks module (db-tasks) in a future iteration.
 */

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftTask {
  id: string;
  shift_id: string;
  task_id: string;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  task?: Task;
}

export function useTasks(_projectId?: string | null) {
  const [tasks] = useState<Task[]>([]);
  const loading = false;

  const createTask = useCallback(async (_data: Partial<Task>) => {
    return { data: null, error: null };
  }, []);

  const updateTask = useCallback(async (_id: string, _data: Partial<Task>) => {
    return { data: null, error: null };
  }, []);

  const deleteTask = useCallback(async (_id: string) => {
    return { error: null };
  }, []);

  return { tasks, loading, createTask, updateTask, deleteTask, refetch: async () => {} };
}

export function useShiftTasks(_shiftId?: string | null) {
  const [shiftTasks] = useState<ShiftTask[]>([]);
  const loading = false;

  const assignTask = useCallback(async (_shiftId: string, _taskId: string) => {
    return { data: null, error: null };
  }, []);

  const unassignTask = useCallback(async (_id: string) => {
    return { error: null };
  }, []);

  const completeTask = useCallback(async (_id: string) => {
    return { error: null };
  }, []);

  const uncompleteTask = useCallback(async (_id: string) => {
    return { error: null };
  }, []);

  return { shiftTasks, loading, assignTask, unassignTask, completeTask, uncompleteTask, refetch: async () => {} };
}

export function useCompletedTasks() {
  const [tasks] = useState<(ShiftTask & { task?: Task })[]>([]);
  const loading = false;
  return { tasks, loading, refetch: async () => {} };
}
