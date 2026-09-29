"use client";
import { useState, useEffect, useCallback } from 'react';
import { hrList, hrCreate } from '@/lib/hr-api';

export interface TimeOffRequest {
  id: string;
  userId: string;
  requestType: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useTimeOffRequests() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // A failed load must not read as "no requests" — callers can show it (pd.md: fail loudly).
  const [error, setError] = useState<Error | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrList<TimeOffRequest>('time-off');
      setRequests(data);
      setError(null);
    } catch (err) {
      console.error('[useTimeOffRequests] fetch error:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (data: {
    requestType: string;
    startDate: string;
    endDate: string;
    notes?: string;
    userId?: string;
  }) => {
    try {
      const req = await hrCreate<TimeOffRequest>('time-off', data);
      setRequests(prev => [req, ...prev]);
      return { data: req, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      const { hrUpdate: update } = await import('@/lib/hr-api');
      await update('time-off', id, { status: 'cancelled' });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const deleteRequest = async (id: string) => {
    return cancelRequest(id);
  };

  return {
    requests,
    loading,
    error,
    createRequest,
    cancelRequest,
    deleteRequest,
    refetch: fetchRequests,
  };
}
