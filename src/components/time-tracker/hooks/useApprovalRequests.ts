"use client";
import { useState, useCallback, useEffect } from 'react';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { hrList, hrUpdate } from '@/components/time-tracker/lib/hr-api';

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
  user_profile?: { full_name: string } | null;
  requester_profile?: { full_name: string } | null;
}

export function useApprovalRequests() {
  const { isAdmin, userId } = useUserRoles();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await hrList<any>('approval-requests');
      const pending = (data || []).filter((entry: any) => entry.status === 'pending');
      
      const profiles = await hrList<any>('employees');
      const profileMap = new Map(profiles?.map((p: any) => [p.userId, p]) || []);

      const mapped: ApprovalRequest[] = pending.map((p: any) => ({
        id: p.id,
        request_type: p.requestType,
        entity_id: p.requestData?.entityId || p.id,
        entity_type: p.entityType,
        user_id: p.userId,
        requested_by: p.requestedBy,
        status: p.status,
        request_data: p.requestData,
        notes: p.notes || null,
        reviewed_by: p.reviewedBy || null,
        reviewed_at: p.reviewedAt || null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        user_profile: (() => {
            const emp = profileMap.get(p.userId) as any;
            return emp ? { full_name: `${emp.firstName} ${emp.lastName}`.trim() } : null;
        })(),
      }));

      setRequests(mapped);
    } catch (err) {
      console.error('[ApprovalRequests] error fetching requests', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = useCallback(async () => {
    // Scaffold no-op
    return { data: null, error: null };
  }, []);

  const approveRequest = useCallback(async (requestId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    try {
      await hrUpdate('approval-requests', requestId, { status: 'approved', reviewedBy: userId, reviewedAt: new Date().toISOString() });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, [isAdmin, userId]);

  const rejectRequest = useCallback(async (requestId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    try {
      await hrUpdate('approval-requests', requestId, { status: 'rejected', reviewedBy: userId, reviewedAt: new Date().toISOString() });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, [isAdmin, userId]);

  const bulkApprove = useCallback(async (requestIds: string[]) => {
    if (!isAdmin) return { error: new Error('Not authorized'), successCount: 0 };
    let successCount = 0;
    for (const id of requestIds) {
      const res = await approveRequest(id);
      if (!res.error) successCount++;
    }
    return { error: null, successCount };
  }, [isAdmin, approveRequest]);

  const bulkReject = useCallback(async (requestIds: string[]) => {
    if (!isAdmin) return { error: new Error('Not authorized'), successCount: 0 };
    let successCount = 0;
    for (const id of requestIds) {
      const res = await rejectRequest(id);
      if (!res.error) successCount++;
    }
    return { error: null, successCount };
  }, [isAdmin, rejectRequest]);

  return {
    requests,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    bulkApprove,
    bulkReject,
    refetch: fetchRequests,
    pendingCount: requests.length,
  };
}
