"use client";
import { useState, useCallback, useEffect } from 'react';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { hrList, hrCreate, hrUpdate } from '@/lib/hr-api';

export interface ApprovalRequest {
  id: string;
  requestType: string;
  entityId: string | null;
  entityType: string;
  userId: string;
  requestedBy: string;
  status: string;
  requestData: unknown;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userProfile?: { name: string } | null;
  requesterProfile?: { name: string } | null;
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
        requestType: p.requestType,
        entityId: p.requestData?.entityId || p.id,
        entityType: p.entityType,
        userId: p.userId,
        requestedBy: p.requestedBy,
        status: p.status,
        requestData: p.requestData,
        notes: p.notes || null,
        reviewedBy: p.reviewedBy || null,
        reviewedAt: p.reviewedAt || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        userProfile: (() => {
            const emp = profileMap.get(p.userId) as any;
            return emp ? { name: `${emp.firstName} ${emp.lastName}`.trim() } : null;
        })(),
        requesterProfile: (() => {
            const emp = profileMap.get(p.requestedBy) as any;
            return emp ? { name: `${emp.firstName} ${emp.lastName}`.trim() } : null;
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
    requestType?: string,
    entityId?: string,
    entityType?: string,
    requestedBy?: string,
    details?: any,
    reason?: string
  ) => {
    try {
      const payload = {
        requestType: requestType || 'general',
        entityType: entityType || 'general',
        userId: requestedBy || userId,
        requestedBy: requestedBy || userId,
        requestData: { ...(details || {}), entityId },
        notes: reason || null,
        status: 'pending',
      };
      const result = await hrCreate<any>('approval-requests', payload);
      await fetchRequests();
      return { data: result, error: null };
    } catch (err: any) {
      console.error('[ApprovalRequests] error creating request', err);
      return { data: null, error: err };
    }
  }, [userId, fetchRequests]);

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
