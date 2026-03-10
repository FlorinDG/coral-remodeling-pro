"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export interface ClockEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  task_description: string | null;
}

export function useClockEntries() {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState<ClockEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveEntry = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('clock_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .maybeSingle();

    if (!error && data) {
      setActiveEntry(data);
    } else {
      setActiveEntry(null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchActiveEntry();
    } else {
      setActiveEntry(null);
      setLoading(false);
    }
  }, [user?.id, fetchActiveEntry]);

  const clockIn = useCallback(async (
    location: { latitude: number; longitude: number } | null,
    shiftId?: string | null
  ) => {
    if (!user) return { error: new Error('Not authenticated'), data: null };

    const { data, error } = await supabase
      .from('clock_entries')
      .insert({
        user_id: user.id,
        clock_in_latitude: location?.latitude || null,
        clock_in_longitude: location?.longitude || null,
      })
      .select()
      .single();

    if (!error && data) {
      setActiveEntry(data);
      
      // If there's a shift, update its status and link the clock entry
      if (shiftId) {
        await supabase
          .from('scheduled_shifts')
          .update({
            status: 'In Progress',
            clock_entry_id: data.id,
            last_edited_by: user.id,
          })
          .eq('id', shiftId);
      }
    }

    return { data, error };
  }, [user?.id]);

  const clockOut = useCallback(async (
    taskDescription: string,
    location: { latitude: number; longitude: number } | null,
    shiftId?: string | null,
    noBreak?: boolean
  ) => {
    if (!user || !activeEntry) return { error: new Error('No active entry'), data: null };

    // Calculate clock out time - subtract 30 minutes if break was taken (noBreak is false/undefined)
    const now = new Date();
    const clockOutTime = noBreak ? now : new Date(now.getTime() - 30 * 60 * 1000);

    const { data, error } = await supabase
      .from('clock_entries')
      .update({
        clock_out_time: clockOutTime.toISOString(),
        clock_out_latitude: location?.latitude || null,
        clock_out_longitude: location?.longitude || null,
        task_description: taskDescription,
      })
      .eq('id', activeEntry.id)
      .select()
      .single();

    if (!error) {
      setActiveEntry(null);
      
      // If there's a shift, update its status to Completed
      if (shiftId) {
        await supabase
          .from('scheduled_shifts')
          .update({
            status: 'Completed',
            last_edited_by: user.id,
          })
          .eq('id', shiftId);
      }
    }

    return { data, error };
  }, [user?.id, activeEntry?.id]);

  return useMemo(() => ({
    activeEntry,
    loading,
    clockIn,
    clockOut,
    refetch: fetchActiveEntry,
  }), [activeEntry, loading, clockIn, clockOut, fetchActiveEntry]);
}
