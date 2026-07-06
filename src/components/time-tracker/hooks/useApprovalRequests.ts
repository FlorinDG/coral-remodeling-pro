"use client";
import { useState, useCallback } from 'react';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';

/**
 * Approval requests — SCAFFOLD
 * 
 * Currently uses local state. Full workflow with Prisma model
 * will be built in Q4 as part of enterprise tier.
 * 
 * The interface is preserved so the Admin.tsx / ApprovalManager.tsx
 * components continue to render without errors.
 */

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
      const data = await hrList<any>('clock-entries');
      const pending = data.filter((entry: any) => entry.requiresApproval === true && entry.approvalStatus === 'pending');
      
      const profiles = await hrList<any>('employees');
      const profileMap = new Map(profiles?.map((p: any) => [p.userId, p]) || []);

      const mapped: ApprovalRequest[] = pending.map((p: any) => ({
        id: p.id,
        request_type: 'clock_entry',
        entity_id: p.id,
        entity_type: 'clock_entry',
        user_id: p.userId,
        requested_by: p.userId,
        status: p.approvalStatus,
        request_data: p,
        notes: p.taskDescription || null,
        reviewed_by: null,
        reviewed_at: null,
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

  const createRequest = useCallback(async (
    _requestType: string,
    _entityId: string | null,
    _entityType: string,
    _userId: string,
    _requestData?: Record<string, unknown>,
    _notes?: string
  ) => {
    // Scaffold no-op
    return { data: null, error: null };
  }, []);

  const approveRequest = useCallback(async (requestId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    try {
      await hrUpdate('clock-entries', requestId, { approvalStatus: 'approved', approvedBy: userId, approvedAt: new Date().toISOString() });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, [isAdmin, userId]);

  const rejectRequest = useCallback(async (requestId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    try {
      await hrUpdate('clock-entries', requestId, { approvalStatus: 'rejected', approvedBy: userId, approvedAt: new Date().toISOString() });
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
