"use client";
import { useState, useCallback } from 'react';

/**
 * Schedule Attachments — scaffold.
 * File uploads will use CoralOS Drive integration when connected.
 */

export interface ScheduleAttachment {
  id: string;
  shift_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  source_project_id: string | null;
  created_at: string;
}

export function useScheduleAttachments() {
  const [attachments] = useState<ScheduleAttachment[]>([]);

  const uploadAttachment = useCallback(async (_shiftId: string, _file: File) => {
    console.log('[ScheduleAttachments] upload — scaffold, no-op');
    return { data: null, error: null };
  }, []);

  const fetchAttachments = useCallback(async (_shiftId: string) => {
    return { data: [] as ScheduleAttachment[], error: null };
  }, []);

  const deleteAttachment = useCallback(async (_id: string) => {
    return { error: null };
  }, []);

  const getPublicUrl = useCallback((_filePath: string) => {
    return '';
  }, []);

  return {
    attachments,
    loading: false,
    uploadAttachment,
    fetchAttachments,
    deleteAttachment,
    getPublicUrl,
  };
}
