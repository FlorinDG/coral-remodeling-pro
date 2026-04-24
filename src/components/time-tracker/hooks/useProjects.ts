"use client";
import { useState, useEffect, useCallback } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';
import { toast } from 'sonner';

export interface Project {
  id: string;
  name: string;
  address: string | null;
  color: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await hrList<Project>('projects');
      setProjects(data);
    } catch (err) {
      console.error('[useProjects] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (data: { name: string; color?: string; address?: string }) => {
    try {
      const project = await hrCreate<Project>('projects', data);
      setProjects(prev => [...prev, project]);
      toast.success('Project created');
      return { data: project, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err };
    }
  }, []);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    try {
      const project = await hrUpdate<Project>('projects', id, data);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...project } : p));
      return { data: project, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await hrDelete('projects', id);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Project deleted');
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
  };
}
