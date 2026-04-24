"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';

export interface WorkerSchedule {
  id: string;
  userId: string;
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerWithProfile {
  user_id: string;
  full_name: string;
  schedules: WorkerSchedule[];
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useWorkerSchedules() {
  const [schedules, setSchedules] = useState<WorkerSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await hrList<WorkerSchedule>('worker-schedules');
      setSchedules(data);
    } catch (err) {
      console.error('[useWorkerSchedules] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Group schedules by userId to derive worker list
  const allWorkers = useMemo(() => {
    const map = new Map<string, WorkerSchedule[]>();
    schedules.forEach(s => {
      if (!map.has(s.userId)) map.set(s.userId, []);
      map.get(s.userId)!.push(s);
    });
    return Array.from(map.entries()).map(([userId, userSchedules]) => ({
      user_id: userId,
      full_name: userId, // Will be resolved by UI from db-employees
      schedules: userSchedules,
    }));
  }, [schedules]);

  const createSchedule = useCallback(async (data: {
    userId: string;
    dayOfWeek: number;
    shiftStart: string;
    shiftEnd: string;
  }) => {
    try {
      const schedule = await hrCreate<WorkerSchedule>('worker-schedules', data);
      setSchedules(prev => [...prev, schedule]);
      return { data: schedule, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const updateSchedule = useCallback(async (id: string, data: Partial<WorkerSchedule>) => {
    try {
      const updated = await hrUpdate<WorkerSchedule>('worker-schedules', id, data);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
      return { data: updated, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    try {
      await hrDelete('worker-schedules', id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  return {
    schedules,
    allWorkers,
    DAY_NAMES,
    loading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    refetch: fetchSchedules,
  };
}
