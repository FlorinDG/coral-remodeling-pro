"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { toast } from 'sonner';
import { validateFile, getSafeFileType, generateSafeFilePath } from '@/components/time-tracker/lib/fileValidation';

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

export function useScheduleAttachments(shiftId: string | null) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<ScheduleAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!shiftId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('schedule_attachments')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching schedule attachments:', error);
    } else {
      setAttachments(data || []);
    }
    setLoading(false);
  }, [shiftId]);

  const uploadFile = async (file: File) => {
    if (!shiftId || !user) return { error: new Error('Not authenticated') };

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return { error: new Error(validation.error) };
    }

    const filePath = generateSafeFilePath(`schedules/${shiftId}`, file);

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
      .from('schedule_attachments')
      .insert({
        shift_id: shiftId,
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

  const addFromProject = async (projectAttachment: {
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number | null;
    project_id: string;
  }) => {
    if (!shiftId || !user) return { error: new Error('Not authenticated') };

    // Create attachment record linking to project file
    const { data, error } = await supabase
      .from('schedule_attachments')
      .insert({
        shift_id: shiftId,
        file_name: projectAttachment.file_name,
        file_path: projectAttachment.file_path,
        file_type: projectAttachment.file_type,
        file_size: projectAttachment.file_size,
        uploaded_by: user.id,
        source_project_id: projectAttachment.project_id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add attachment');
      return { error };
    }

    setAttachments(prev => [data, ...prev]);
    toast.success('File added from project');
    return { data };
  };

  const deleteAttachment = async (attachment: ScheduleAttachment) => {
    // Only delete from storage if not linked from a project
    if (!attachment.source_project_id) {
      await supabase.storage
        .from('project-files')
        .remove([attachment.file_path]);
    }

    // Delete record
    const { error } = await supabase
      .from('schedule_attachments')
      .delete()
      .eq('id', attachment.id);

    if (error) {
      toast.error('Failed to delete attachment');
      return { error };
    }

    setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    toast.success('Attachment removed');
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
    addFromProject,
    deleteAttachment,
    getSignedUrl,
    setAttachments,
  };
}
