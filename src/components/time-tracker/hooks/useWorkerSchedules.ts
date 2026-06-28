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
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const [scheduleData, employeeData] = await Promise.all([
        hrList<WorkerSchedule>('worker-schedules'),
        hrList<{ id: string; firstName: string; lastName: string; status: string; schedule?: boolean }>('employees').catch(() => [])
      ]);
      setSchedules(scheduleData);
      setEmployees(employeeData.filter(e => e.schedule !== false));
    } catch (err) {
      console.error('[useWorkerSchedules] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Group schedules by userId to derive worker list, only for active employees
  const allWorkers = useMemo(() => {
    return employees.map(emp => {
      const userSchedules = schedules.filter(s => s.userId === emp.id);
      return {
        user_id: emp.id,
        full_name: `${emp.firstName} ${emp.lastName}`,
        schedules: userSchedules,
      };
    });
  }, [schedules, employees]);

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
