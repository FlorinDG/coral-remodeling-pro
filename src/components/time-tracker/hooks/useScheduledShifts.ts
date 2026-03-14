"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useDatabaseStore } from '@/components/admin/database/store';

// Notion colors for projects
export const NOTION_COLORS = [
  { name: 'default', value: '#37352F', bg: '#F1F1EF' },
  { name: 'gray', value: '#787774', bg: '#E3E2E0' },
  { name: 'brown', value: '#64473A', bg: '#EEE0DA' },
  { name: 'orange', value: '#D9730D', bg: '#FADEC9' },
  { name: 'yellow', value: '#CB912F', bg: '#FDECC8' },
  { name: 'green', value: '#448361', bg: '#DBEDDB' },
  { name: 'blue', value: '#337EA9', bg: '#D3E5EF' },
  { name: 'purple', value: '#9065B0', bg: '#E8DEEE' },
  { name: 'pink', value: '#C14C8A', bg: '#F5E0E9' },
  { name: 'red', value: '#D44C47', bg: '#FFE2DD' },
] as const;

export interface Project {
  id: string;
  name: string;
  address: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ScheduledShift {
  id: string;
  user_id: string;
  project_id: string | null;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  role: string | null;
  status: string;
  shift_name: string | null;
  notes: string | null;
  clock_entry_id: string | null;
  notion_page_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_edited_by: string | null;
  // Joined data
  project?: Project;
  profile?: { full_name: string };
}

export function useScheduledShifts() {
  const { user } = useAuth();
  const { isAdmin, isManager } = useUserRoles();
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    setProjects(data || []);
  }, []);

  const fetchShifts = useCallback(async () => {
    if (!user) return;

    // Fetch shifts with project data
    const { data: shiftsData, error: shiftsError } = await supabase
      .from('scheduled_shifts')
      .select(`
        *,
        project:projects(*)
      `)
      .order('shift_date', { ascending: true })
      .order('shift_start', { ascending: true });

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return;
    }

    // Fetch profiles separately to avoid FK issue
    const userIds = [...new Set((shiftsData || []).map(s => s.user_id))];

    let profileMap: Record<string, { full_name: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name };
        return acc;
      }, {} as Record<string, { full_name: string }>);
    }

    // Fetch from Internal Workforce Database (db-hr)
    const hrDb = useDatabaseStore.getState().getDatabase('db-hr');
    const hrProfileMap: Record<string, { full_name: string }> = {};
    if (hrDb) {
      hrDb.pages.forEach(page => {
        hrProfileMap[page.id] = { full_name: String(page.properties['title'] || 'Unknown') };
      });
    }

    // Combine shifts with profile data
    const transformedData: ScheduledShift[] = (shiftsData || []).map(shift => ({
      ...shift,
      profile: profileMap[shift.user_id] || hrProfileMap[shift.user_id] || { full_name: 'Unknown Staff' },
      project: shift.project || undefined, // Fix project being null vs undefined
    })) as unknown as ScheduledShift[];

    setShifts(transformedData);
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchShifts()]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user, fetchProjects, fetchShifts]);

  const createProject = async (name: string, address: string | null, color: string) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        address,
        color,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      throw error;
    }

    await fetchProjects();
    return data;
  };

  const createShift = async (shift: {
    user_id: string;
    project_id?: string | null;
    shift_date: string;
    shift_start: string;
    shift_end: string;
    role?: string | null;
    notes?: string | null;
  }) => {
    const { data, error } = await supabase
      .from('scheduled_shifts')
      .insert({
        ...shift,
        created_by: user?.id,
        last_edited_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shift:', error);
      throw error;
    }

    await fetchShifts();
    return data;
  };

  const updateShiftStatus = async (shiftId: string, status: string, clockEntryId?: string) => {
    const updateData: Record<string, unknown> = {
      status,
      last_edited_by: user?.id,
    };

    if (clockEntryId) {
      updateData.clock_entry_id = clockEntryId;
    }

    const { error } = await supabase
      .from('scheduled_shifts')
      .update(updateData)
      .eq('id', shiftId);

    if (error) {
      console.error('Error updating shift status:', error);
      throw error;
    }

    await fetchShifts();
  };

  const deleteShift = async (shiftId: string) => {
    const { error } = await supabase
      .from('scheduled_shifts')
      .delete()
      .eq('id', shiftId);

    if (error) {
      console.error('Error deleting shift:', error);
      throw error;
    }

    await fetchShifts();
  };

  const updateShift = async (shiftId: string, updates: {
    user_id?: string;
    shift_date?: string;
    shift_start?: string;
    shift_end?: string;
    project_id?: string | null;
    role?: string | null;
    notes?: string | null;
  }) => {
    const { error } = await supabase
      .from('scheduled_shifts')
      .update({
        ...updates,
        last_edited_by: user?.id,
      })
      .eq('id', shiftId);

    if (error) {
      console.error('Error updating shift:', error);
      throw error;
    }

    await fetchShifts();
  };

  // Format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return shifts.filter(s => s.shift_date === dateStr);
  };

  // Get shifts grouped by date for week view
  const getShiftsByWeek = (startDate: Date) => {
    const weekShifts: Record<string, ScheduledShift[]> = {};

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = formatLocalDate(date);
      weekShifts[dateStr] = shifts.filter(s => s.shift_date === dateStr);
    }

    return weekShifts;
  };

  // Get today's shift for the current user
  const getTodayShift = () => {
    const today = formatLocalDate(new Date());
    return shifts.find(s => s.shift_date === today && s.user_id === user?.id);
  };

  // Create a user-initiated shift (when clocking in without a scheduled shift)
  const createUserShift = async (clockEntryId: string) => {
    if (!user) return null;

    const now = new Date();
    const today = formatLocalDate(now);
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const { data, error } = await supabase
      .from('scheduled_shifts')
      .insert({
        user_id: user.id,
        shift_date: today,
        shift_start: currentTime,
        shift_end: currentTime, // Will be updated on clock out
        status: 'In Progress',
        clock_entry_id: clockEntryId,
        notes: 'User-created shift (clocked in without schedule)',
        created_by: user.id,
        last_edited_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user shift:', error);
      return null;
    }

    await fetchShifts();
    return data;
  };

  // Update shift end time on clock out
  const completeUserShift = async (shiftId: string) => {
    if (!user) return;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    await supabase
      .from('scheduled_shifts')
      .update({
        shift_end: currentTime,
        status: 'Completed',
        last_edited_by: user.id,
      })
      .eq('id', shiftId);

    await fetchShifts();
  };

  return {
    shifts,
    projects,
    loading,
    createProject,
    createShift,
    updateShift,
    updateShiftStatus,
    deleteShift,
    getShiftsForDate,
    getShiftsByWeek,
    getTodayShift,
    createUserShift,
    completeUserShift,
    refetch: () => Promise.all([fetchProjects(), fetchShifts()]),
    canManage: isAdmin || isManager,
  };
}
