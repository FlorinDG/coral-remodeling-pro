"use client";
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
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
  noBreak?: boolean;
  no_break?: boolean;
  photos?: string[];
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

function addSnake(e: ClockEntry): ClockEntry {
  return {
    ...e,
    user_id: e.userId,
    clock_in_time: e.clockInTime,
    clock_out_time: e.clockOutTime,
    shiftId: e.shiftId,
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
    no_break: e.noBreak,
    photos: e.photos,
  };
}

export function useClockEntries() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId || 'no-tenant';
  const queryKey = ['clock-entries', tenantId];

  const { data: entries = [] as ClockEntry[], isLoading: loading, error, refetch } = useQuery<ClockEntry[]>({
    queryKey,
    queryFn: async () => {
      const data = await hrList<ClockEntry>('clock-entries');
      return data.map(addSnake);
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const activeEntry = useMemo(() => {
    return entries.find(e => !e.clockOutTime) || null;
  }, [entries]);

  const clockInMutation = useMutation({
    mutationFn: async (data: {
      clockInLatitude?: number;
      clockInLongitude?: number;
      taskDescription?: string;
      shiftId?: string;
    }) => {
      const entry = await hrCreate<ClockEntry>('clock-entries', {
        clockInTime: new Date().toISOString(),
        ...data,
      });
      return addSnake(entry);
    },
    onSuccess: (newEntry) => {
      queryClient.setQueryData<ClockEntry[]>(queryKey, (old = []) => [newEntry, ...old]);
      queryClient.invalidateQueries({ queryKey });
    }
  });

  const clockOutMutation = useMutation({
    mutationFn: async (data?: {
      clockOutLatitude?: number;
      clockOutLongitude?: number;
      taskDescription?: string;
      photos?: File[];
      noBreak?: boolean;
    }) => {
      const currentEntries = queryClient.getQueryData<ClockEntry[]>(queryKey) || [];
      const currentActive = currentEntries.find(e => !e.clockOutTime);
      if (!currentActive) throw new Error('No active entry');

      let photoUrls: string[] = [];
      if (data?.photos && data.photos.length > 0) {
        const uploadPromises = data.photos.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          
          const { uploadFileAction } = await import('@/app/actions/files');
          const result = await uploadFileAction(formData, 'hr', currentActive.id);
          if (!result.success || !result.key) throw new Error(result.error || 'Upload failed');
          return result.key;
        });
        photoUrls = await Promise.all(uploadPromises);
      }

      const updated = await hrUpdate<ClockEntry>('clock-entries', currentActive.id, {
        clockOutTime: new Date().toISOString(),
        taskDescription: data?.taskDescription,
        clockOutLatitude: data?.clockOutLatitude,
        clockOutLongitude: data?.clockOutLongitude,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
        noBreak: data?.noBreak,
      });
      return addSnake(updated);
    },
    onSuccess: (updatedEntry) => {
      queryClient.setQueryData<ClockEntry[]>(queryKey, (old = []) => 
        old.map(e => e.id === updatedEntry.id ? updatedEntry : e)
      );
      queryClient.invalidateQueries({ queryKey });
    }
  });

  const clockIn = async (data: any) => {
    try {
      const res = await clockInMutation.mutateAsync(data);
      return { data: res, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const clockOut = async (data?: any) => {
    try {
      const res = await clockOutMutation.mutateAsync(data);
      return { data: res, error: null };
    } catch (err: any) {
      console.error('[useClockEntries] Clock out error:', err);
      return { data: null, error: err };
    }
  };

  return {
    entries,
    activeEntry,
    loading,
    error: error as Error | null,
    clockIn,
    clockOut,
    refetch,
  };
}
