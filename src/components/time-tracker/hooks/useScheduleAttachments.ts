import { useState, useCallback, useEffect } from 'react';
import { hrList, hrCreate, hrDelete } from '@/components/time-tracker/lib/hr-api';

export interface ScheduleAttachment {
  id: string;
  shiftId: string;
  name: string;
  url: string;
  type: string;
  size: number | null;
  createdAt: string;
  // Legacy aliases
  shift_id?: string;
  file_name?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number | null;
  source_project_id?: string | null;
}

export function useScheduleAttachments(shiftId?: string | null) {
  const [attachments, setAttachments] = useState<ScheduleAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!shiftId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    try {
      const data = await hrList<ScheduleAttachment>('shift-attachments', { shiftId });
      setAttachments(data.map(a => ({
        ...a,
        shift_id: a.shiftId,
        file_name: a.name,
        file_path: a.url,
        file_type: a.type,
        file_size: a.size,
      })));
    } catch (err) {
      console.error('Failed to fetch shift attachments:', err);
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const uploadFile = useCallback(async (file: File) => {
    if (!shiftId) return;
    try {
      // In a real app, we'd upload to S3/Drive first and get a URL
      // For now, we mock the URL as it's a "Production Hardening" but we don't have the storage config
      const mockUrl = `/uploads/${file.name}`;
      const res = await hrCreate('shift-attachments', {
        shiftId,
        name: file.name,
        url: mockUrl,
        type: file.type,
        size: file.size,
      });
      setAttachments(prev => [...prev, {
        ...res,
        shift_id: res.shiftId,
        file_name: res.name,
        file_path: res.url,
        file_type: res.type,
        file_size: res.size,
      }]);
      return res;
    } catch (err) {
      throw err;
    }
  }, [shiftId]);

  const addFromProject = useCallback(async (data: any) => {
    if (!shiftId) return;
    try {
      const res = await hrCreate('shift-attachments', {
        shiftId,
        name: data.file_name,
        url: data.file_path,
        type: data.file_type,
        size: data.file_size,
      });
      setAttachments(prev => [...prev, {
        ...res,
        shift_id: res.shiftId,
        file_name: res.name,
        file_path: res.url,
        file_type: res.type,
        file_size: res.size,
      }]);
      return res;
    } catch (err) {
      throw err;
    }
  }, [shiftId]);

  const deleteAttachment = useCallback(async (attachment: ScheduleAttachment) => {
    try {
      await hrDelete('shift-attachments', attachment.id);
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    attachments,
    loading,
    uploadFile,
    addFromProject,
    fetchAttachments,
    deleteAttachment,
    setAttachments,
    getPublicUrl: (path: string) => path,
  };
}
