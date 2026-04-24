"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { hrList, hrCreate, hrUpdate } from '@/components/time-tracker/lib/hr-api';

export interface ClockEntry {
  id: string;
  userId: string;
  clockInTime: string;
  clockOutTime: string | null;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
  taskDescription: string | null;
  requiresApproval: boolean;
  approvalStatus: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  shiftId: string | null;
  createdAt: string;
  updatedAt: string;
  // snake_case aliases for legacy components
  user_id?: string;
  clock_in_time?: string;
  clock_out_time?: string | null;
  clock_in_latitude?: number | null;
  clock_in_longitude?: number | null;
  clock_out_latitude?: number | null;
  clock_out_longitude?: number | null;
  task_description?: string | null;
  requires_approval?: boolean;
  approval_status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function useClockEntries() {
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  function addSnake(e: ClockEntry): ClockEntry {
    return {
      ...e,
      user_id: e.userId,
      clock_in_time: e.clockInTime,
      clock_out_time: e.clockOutTime,
      clock_in_latitude: e.clockInLatitude,
      clock_in_longitude: e.clockInLongitude,
      clock_out_latitude: e.clockOutLatitude,
      clock_out_longitude: e.clockOutLongitude,
      task_description: e.taskDescription,
      requires_approval: e.requiresApproval,
      approval_status: e.approvalStatus,
      approved_by: e.approvedBy,
      approved_at: e.approvedAt,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
    };
  }

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await hrList<ClockEntry>('clock-entries');
      setEntries(data.map(addSnake));
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const activeEntry = useMemo(() => {
    return entries.find(e => !e.clockOutTime) || null;
  }, [entries]);

  const clockIn = useCallback(async (data: {
    clockInLatitude?: number;
    clockInLongitude?: number;
    taskDescription?: string;
    shiftId?: string;
  }) => {
    try {
      const entry = await hrCreate<ClockEntry>('clock-entries', {
        clockInTime: new Date().toISOString(),
        ...data,
      });
      const enriched = addSnake(entry);
      setEntries(prev => [enriched, ...prev]);
      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const clockOut = useCallback(async (data?: {
    clockOutLatitude?: number;
    clockOutLongitude?: number;
    taskDescription?: string;
  }) => {
    if (!activeEntry) return { data: null, error: new Error('No active entry') };
    try {
      const updated = await hrUpdate<ClockEntry>('clock-entries', activeEntry.id, {
        clockOutTime: new Date().toISOString(),
        ...data,
      });
      const enriched = addSnake(updated);
      setEntries(prev => prev.map(e => e.id === enriched.id ? enriched : e));
      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, [activeEntry]);

  return {
    entries,
    activeEntry,
    loading,
    error,
    clockIn,
    clockOut,
    refetch: fetchEntries,
  };
}
