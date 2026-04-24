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
  const [requests] = useState<ApprovalRequest[]>([]);
  const loading = false;

  const createRequest = useCallback(async (
    _requestType: string,
    _entityId: string | null,
    _entityType: string,
    _userId: string,
    _requestData?: Record<string, unknown>,
    _notes?: string
  ) => {
    // TODO Q4: POST /api/hr/approval-requests
    console.log('[ApprovalRequests] create — scaffold, no-op');
    return { data: null, error: null };
  }, []);

  const approveRequest = useCallback(async (_requestId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    console.log('[ApprovalRequests] approve — scaffold, no-op');
    return { error: null };
  }, [isAdmin]);

  const rejectRequest = useCallback(async (_requestId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    return { error: null };
  }, [isAdmin]);

  const bulkApprove = useCallback(async (requestIds: string[]) => {
    if (!isAdmin) return { error: new Error('Not authorized'), successCount: 0 };
    return { error: null, successCount: requestIds.length };
  }, [isAdmin]);

  const bulkReject = useCallback(async (requestIds: string[]) => {
    if (!isAdmin) return { error: new Error('Not authorized'), successCount: 0 };
    return { error: null, successCount: requestIds.length };
  }, [isAdmin]);

  return {
    requests,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    bulkApprove,
    bulkReject,
    refetch: async () => {},
    pendingCount: 0,
  };
}
