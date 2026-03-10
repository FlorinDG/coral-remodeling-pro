"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export interface WorkerSchedule {
  id: string;
  user_id: string;
  day_of_week: number;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkerWithProfile {
  id: string;
  full_name: string;
  schedules: WorkerSchedule[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useWorkerSchedules() {
  const { user } = useAuth();
  const [mySchedules, setMySchedules] = useState<WorkerSchedule[]>([]);
  const [allWorkers, setAllWorkers] = useState<WorkerWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch current user's schedules
  const fetchMySchedules = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('worker_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week');

    if (!error && data) {
      setMySchedules(data as WorkerSchedule[]);
    }
  }, [user]);

  // Fetch all workers with their schedules (for managers)
  const fetchAllWorkers = useCallback(async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return;
    }

    const { data: schedules, error: schedulesError } = await supabase
      .from('worker_schedules')
      .select('*')
      .order('day_of_week');

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return;
    }

    const workers: WorkerWithProfile[] = (profiles || []).map(profile => ({
      id: profile.user_id,
      full_name: profile.full_name || 'Unknown Worker',
      schedules: (schedules || []).filter(s => s.user_id === profile.user_id) as WorkerSchedule[],
    }));

    setAllWorkers(workers);
  }, []);

  // Create or update a schedule
  const upsertSchedule = async (
    userId: string,
    dayOfWeek: number,
    shiftStart: string,
    shiftEnd: string,
    isActive: boolean = true
  ) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('worker_schedules')
      .upsert({
        user_id: userId,
        day_of_week: dayOfWeek,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        is_active: isActive,
        created_by: user.id,
      }, {
        onConflict: 'user_id,day_of_week',
      })
      .select()
      .single();

    if (!error) {
      await fetchAllWorkers();
      if (userId === user.id) {
        await fetchMySchedules();
      }
    }

    return { data, error };
  };

  // Delete a schedule
  const deleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase
      .from('worker_schedules')
      .delete()
      .eq('id', scheduleId);

    if (!error) {
      await fetchAllWorkers();
      await fetchMySchedules();
    }

    return { error };
  };

  // Toggle schedule active status
  const toggleScheduleActive = async (scheduleId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('worker_schedules')
      .update({ is_active: isActive })
      .eq('id', scheduleId);

    if (!error) {
      await fetchAllWorkers();
      await fetchMySchedules();
    }

    return { error };
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMySchedules(), fetchAllWorkers()]);
      setLoading(false);
    };
    init();
  }, [fetchMySchedules, fetchAllWorkers]);

  return {
    mySchedules,
    allWorkers,
    loading,
    upsertSchedule,
    deleteSchedule,
    toggleScheduleActive,
    refetch: () => Promise.all([fetchMySchedules(), fetchAllWorkers()]),
    DAY_NAMES,
  };
}
