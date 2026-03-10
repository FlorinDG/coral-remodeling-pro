"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { toast } from 'sonner';
import { validateFile, getSafeFileType, generateSafeFilePath } from '@/components/time-tracker/lib/fileValidation';

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

export function useProjectAttachments(projectId: string | null) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('project_attachments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
    } else {
      setAttachments(data || []);
    }
    setLoading(false);
  }, [projectId]);

  const uploadFile = async (file: File) => {
    if (!projectId || !user) return { error: new Error('Not authenticated') };

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return { error: new Error(validation.error) };
    }

    const filePath = generateSafeFilePath(`projects/${projectId}`, file);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Failed to upload file');
      return { error: uploadError };
    }

    // Create attachment record with validated file type
    const { data, error } = await supabase
      .from('project_attachments')
      .insert({
        project_id: projectId,
        file_name: file.name,
        file_path: filePath,
        file_type: getSafeFileType(file),
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to save attachment');
      return { error };
    }

    setAttachments(prev => [data, ...prev]);
    toast.success('File uploaded');
    return { data };
  };

  const deleteAttachment = async (attachment: ProjectAttachment) => {
    // Delete from storage
    await supabase.storage
      .from('project-files')
      .remove([attachment.file_path]);

    // Delete record
    const { error } = await supabase
      .from('project_attachments')
      .delete()
      .eq('id', attachment.id);

    if (error) {
      toast.error('Failed to delete attachment');
      return { error };
    }

    setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    toast.success('File deleted');
    return {};
  };

  // Use signed URLs for secure file access (1 hour expiry)
  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('project-files')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  };

  return {
    attachments,
    loading,
    fetchAttachments,
    uploadFile,
    deleteAttachment,
    getSignedUrl,
  };
}
