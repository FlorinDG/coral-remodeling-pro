"use client";
import { useState, useEffect } from 'react';
import { hrList, hrCreate } from '@/components/time-tracker/lib/hr-api';

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

  useEffect(() => {
    hrList<TimeOffRequest>('time-off')
      .then(data => {
        setRequests(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const createRequest = async (data: {
    requestType: string;
    startDate: string;
    endDate: string;
    notes?: string;
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
      const { hrUpdate: update } = await import('@/components/time-tracker/lib/hr-api');
      await update('time-off', id, { status: 'cancelled' });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  return {
    requests,
    loading,
    createRequest,
    cancelRequest,
  };
}
