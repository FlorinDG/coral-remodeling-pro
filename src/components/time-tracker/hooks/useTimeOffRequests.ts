"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export interface TimeOffRequest {
  id: string;
  user_id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: string;
  notion_page_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useTimeOffRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setRequests(data as TimeOffRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const createRequest = async (
    requestType: string,
    startDate: string,
    endDate: string,
    notes?: string
  ) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('time_off_requests')
      .insert({
        user_id: user.id,
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
      })
      .select()
      .single();

    if (!error && data) {
      setRequests(prev => [data as TimeOffRequest, ...prev]);
    }

    return { data, error };
  };

  const deleteRequest = async (id: string) => {
    const { error } = await supabase
      .from('time_off_requests')
      .delete()
      .eq('id', id);

    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== id));
    }

    return { error };
  };

  return {
    requests,
    loading,
    createRequest,
    deleteRequest,
    refetch: fetchRequests,
  };
}
