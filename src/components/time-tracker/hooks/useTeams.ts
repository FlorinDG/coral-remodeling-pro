"use client";
import { useState, useEffect, useCallback } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  createdAt: string;
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [teamsData, membersData] = await Promise.all([
        hrList<Team>('teams'),
        hrList<TeamMember>('team-members'),
      ]);
      setTeams(teamsData);
      setMembers(membersData);
    } catch (err) {
      console.error('[useTeams] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createTeam = useCallback(async (data: { name: string; description?: string }) => {
    try {
      const team = await hrCreate<Team>('teams', data);
      setTeams(prev => [...prev, team]);
      toast.success('Team created');
      return { data: team, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err };
    }
  }, []);

  const updateTeam = useCallback(async (id: string, data: Partial<Team>) => {
    try {
      const team = await hrUpdate<Team>('teams', id, data);
      setTeams(prev => prev.map(t => t.id === id ? { ...t, ...team } : t));
      return { data: team, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err };
    }
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    try {
      await hrDelete('teams', id);
      setTeams(prev => prev.filter(t => t.id !== id));
      setMembers(prev => prev.filter(m => m.teamId !== id));
      toast.success('Team deleted');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  const addMember = useCallback(async (teamId: string, userId: string, role = 'member') => {
    try {
      const member = await hrCreate<TeamMember>('team-members', { teamId, userId, role });
      setMembers(prev => [...prev, member]);
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    try {
      await hrDelete('team-members', memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: string) => {
    try {
      await hrUpdate('team-members', memberId, { role });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  const getTeamMembers = useCallback((teamId: string) => {
    return members.filter(m => m.teamId === teamId);
  }, [members]);

  return {
    teams,
    members,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    addTeamMember: addMember,
    removeMember,
    removeTeamMember: removeMember,
    updateMemberRole,
    getTeamMembers,
    refetch: fetchAll,
  };
}
