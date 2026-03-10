"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';

export interface ApprovalRequest {
  id: string;
  request_type: string;
  entity_id: string | null;
  entity_type: string;
  user_id: string;
  requested_by: string;
  status: string;
  request_data: unknown;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_profile?: { full_name: string } | null;
  requester_profile?: { full_name: string } | null;
}

export function useApprovalRequests() {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch approval requests
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching approval requests:', error);
      setLoading(false);
      return;
    }

    // Fetch profile info for users
    const userIds = [...new Set(data?.map(r => [r.user_id, r.requested_by]).flat() || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds.length > 0 ? userIds : ['no-match']);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const enriched = (data || []).map(r => ({
      ...r,
      user_profile: profileMap.get(r.user_id) || null,
      requester_profile: profileMap.get(r.requested_by) || null,
    }));

    setRequests(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (
    requestType: string,
    entityId: string | null,
    entityType: string,
    userId: string,
    requestData?: Record<string, unknown>,
    notes?: string
  ) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('approval_requests')
      .insert([{
        request_type: requestType,
        entity_id: entityId,
        entity_type: entityType,
        user_id: userId,
        requested_by: user.id,
        request_data: requestData ? JSON.parse(JSON.stringify(requestData)) : null,
        notes: notes || null,
      }])
      .select()
      .single();

    if (!error && data) {
      await fetchRequests();
    }

    return { data, error };
  };

  const approveRequest = async (requestId: string) => {
    if (!user || !isAdmin) return { error: new Error('Not authorized') };

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      await fetchRequests();
    }

    return { error };
  };

  const rejectRequest = async (requestId: string) => {
    if (!user || !isAdmin) return { error: new Error('Not authorized') };

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      await fetchRequests();
    }

    return { error };
  };

  const bulkApprove = async (requestIds: string[]) => {
    if (!user || !isAdmin) return { error: new Error('Not authorized'), successCount: 0 };

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .in('id', requestIds);

    if (!error) {
      await fetchRequests();
    }

    return { error, successCount: error ? 0 : requestIds.length };
  };

  const bulkReject = async (requestIds: string[]) => {
    if (!user || !isAdmin) return { error: new Error('Not authorized'), successCount: 0 };

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .in('id', requestIds);

    if (!error) {
      await fetchRequests();
    }

    return { error, successCount: error ? 0 : requestIds.length };
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return {
    requests,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    bulkApprove,
    bulkReject,
    refetch: fetchRequests,
    pendingCount,
  };
}
