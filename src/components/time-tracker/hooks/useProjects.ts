"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { toast } from 'sonner';

export interface Project {
  id: string;
  name: string;
  address: string | null;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (project: { name: string; address?: string; color?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: project.name,
        address: project.address || null,
        color: project.color || 'blue',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create project');
      return { error };
    }

    setProjects(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Project created');
    return { data };
  };

  const updateProject = async (id: string, updates: { name?: string; address?: string; color?: string }) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update project');
      return { error };
    }

    setProjects(prev => prev.map(p => p.id === id ? data : p).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Project updated');
    return { data };
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete project');
      return { error };
    }

    setProjects(prev => prev.filter(p => p.id !== id));
    toast.success('Project deleted');
    return {};
  };

  return {
    projects,
    loading,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
