"use client";
import { useState, useCallback } from 'react';

/**
 * Project Assignments — scaffold.
 * Will connect to HR team assignments in a future iteration.
 */

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface ProjectAssignmentWithProfile extends ProjectAssignment {
  profiles?: { full_name: string } | null;
}

export function useProjectAssignments(_projectId?: string) {
  const [assignments] = useState<ProjectAssignmentWithProfile[]>([]);

  const assignUser = useCallback(async (_projectId: string, _userId: string) => {
    return { data: null, error: null };
  }, []);

  const unassignUser = useCallback(async (_assignmentId: string) => {
    return { error: null };
  }, []);

  return {
    assignments,
    loading: false,
    assignUser,
    unassignUser,
    refetch: async () => {},
  };
}
