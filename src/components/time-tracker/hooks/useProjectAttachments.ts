"use client";
import { useState, useCallback } from 'react';

/**
 * Project Attachments — scaffold.
 * File uploads will use CoralOS Drive integration when connected.
 */

export interface ProjectAttachment {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useProjectAttachments(_projectId: string | null) {
  const [attachments] = useState<ProjectAttachment[]>([]);

  const uploadAttachment = useCallback(async (_file: File) => {
    console.log('[ProjectAttachments] upload — scaffold, no-op');
    return { data: null, error: null };
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
    deleteAttachment,
    getPublicUrl,
    refetch: async () => {},
  };
}
