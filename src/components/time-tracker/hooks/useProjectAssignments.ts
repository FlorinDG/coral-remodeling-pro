"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProjectAssignment {
  id: string;
  user_id: string;
  project_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface ProjectAssignmentWithProfile extends ProjectAssignment {
  profile?: {
    full_name: string;
  };
}

export function useProjectAssignments(projectId?: string) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<ProjectAssignmentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    if (!user || !projectId) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Fetch assignments
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('user_project_assignments')
      .select('*')
      .eq('project_id', projectId);

    if (assignmentError) {
      console.error('Error fetching assignments:', assignmentError);
      setLoading(false);
      return;
    }

    // Fetch profiles for each assignment
    if (assignmentData && assignmentData.length > 0) {
      const userIds = assignmentData.map(a => a.user_id);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const assignmentsWithProfiles = assignmentData.map(assignment => ({
        ...assignment,
        profile: profileData?.find(p => p.user_id === assignment.user_id)
          ? { full_name: profileData.find(p => p.user_id === assignment.user_id)!.full_name }
          : undefined
      }));

      setAssignments(assignmentsWithProfiles);
    } else {
      setAssignments([]);
    }
    
    setLoading(false);
  }, [user, projectId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const assignUser = async (userId: string, projId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('user_project_assignments')
      .insert({
        user_id: userId,
        project_id: projId,
        assigned_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('User is already assigned to this project');
      } else {
        toast.error('Failed to assign user');
      }
      return { error };
    }

    if (projectId === projId) {
      setAssignments(prev => [...prev, data]);
    }
    toast.success('User assigned to project');
    return { data };
  };

  const unassignUser = async (userId: string, projId: string) => {
    const { error } = await supabase
      .from('user_project_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('project_id', projId);

    if (error) {
      toast.error('Failed to unassign user');
      return { error };
    }

    if (projectId === projId) {
      setAssignments(prev => prev.filter(a => a.user_id !== userId));
    }
    toast.success('User unassigned from project');
    return {};
  };

  return {
    assignments,
    loading,
    fetchAssignments,
    assignUser,
    unassignUser,
  };
}
