"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
  profile?: {
    full_name: string;
  };
}

export interface TeamProjectAssignment {
  id: string;
  team_id: string;
  project_id: string;
  assigned_by: string | null;
  created_at: string;
  project?: {
    name: string;
    color: string;
  };
}

export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } else {
      setTeams(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (team: { name: string; description?: string }, ownerId?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Create team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: team.name,
        description: team.description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (teamError) {
      toast.error('Failed to create team');
      return { error: teamError };
    }

    // Add owner (creator or specified user)
    const ownerUserId = ownerId || user.id;
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamData.id,
        user_id: ownerUserId,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding team owner:', memberError);
    }

    setTeams(prev => [...prev, teamData].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Team created');
    return { data: teamData };
  };

  const updateTeam = async (id: string, updates: { name?: string; description?: string }) => {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update team');
      return { error };
    }

    setTeams(prev => prev.map(t => t.id === id ? data : t).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Team updated');
    return { data };
  };

  const deleteTeam = async (id: string) => {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete team');
      return { error };
    }

    setTeams(prev => prev.filter(t => t.id !== id));
    toast.success('Team deleted');
    return {};
  };

  // Team members management
  const fetchTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
    const { data: memberData, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    if (error || !memberData) return [];

    // Fetch profiles
    const userIds = memberData.map(m => m.user_id);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    return memberData.map(member => ({
      ...member,
      role: member.role as 'owner' | 'member',
      profile: profileData?.find(p => p.user_id === member.user_id)
        ? { full_name: profileData.find(p => p.user_id === member.user_id)!.full_name }
        : undefined
    }));
  };

  const addTeamMember = async (teamId: string, userId: string, role: 'owner' | 'member' = 'member') => {
    const { error } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: userId, role });

    if (error) {
      if (error.code === '23505') {
        toast.error('User is already a team member');
      } else {
        toast.error('Failed to add team member');
      }
      return { error };
    }

    toast.success('Member added');
    return {};
  };

  const removeTeamMember = async (teamId: string, userId: string) => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to remove team member');
      return { error };
    }

    toast.success('Member removed');
    return {};
  };

  const updateMemberRole = async (teamId: string, userId: string, role: 'owner' | 'member') => {
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update role');
      return { error };
    }

    toast.success('Role updated');
    return {};
  };

  // Team project assignments
  const fetchTeamProjects = async (teamId: string): Promise<TeamProjectAssignment[]> => {
    const { data: assignmentData, error } = await supabase
      .from('team_project_assignments')
      .select('*')
      .eq('team_id', teamId);

    if (error || !assignmentData) return [];

    // Fetch project details
    const projectIds = assignmentData.map(a => a.project_id);
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, color')
      .in('id', projectIds);

    return assignmentData.map(assignment => ({
      ...assignment,
      project: projectData?.find(p => p.id === assignment.project_id)
    }));
  };

  const assignProjectToTeam = async (teamId: string, projectId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('team_project_assignments')
      .insert({ team_id: teamId, project_id: projectId, assigned_by: user.id });

    if (error) {
      if (error.code === '23505') {
        toast.error('Project already assigned to this team');
      } else {
        toast.error('Failed to assign project');
      }
      return { error };
    }

    toast.success('Project assigned to team');
    return {};
  };

  const unassignProjectFromTeam = async (teamId: string, projectId: string) => {
    const { error } = await supabase
      .from('team_project_assignments')
      .delete()
      .eq('team_id', teamId)
      .eq('project_id', projectId);

    if (error) {
      toast.error('Failed to unassign project');
      return { error };
    }

    toast.success('Project unassigned from team');
    return {};
  };

  return {
    teams,
    loading,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    fetchTeamMembers,
    addTeamMember,
    removeTeamMember,
    updateMemberRole,
    fetchTeamProjects,
    assignProjectToTeam,
    unassignProjectFromTeam,
  };
}
