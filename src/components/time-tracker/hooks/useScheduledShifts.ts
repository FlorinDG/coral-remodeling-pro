"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';

export const NOTION_COLORS = [
  { name: 'blue',    value: '#3b82f6', bg: '#dbeafe' },
  { name: 'red',     value: '#ef4444', bg: '#fee2e2' },
  { name: 'amber',   value: '#f59e0b', bg: '#fef3c7' },
  { name: 'green',   value: '#22c55e', bg: '#dcfce7' },
  { name: 'violet',  value: '#8b5cf6', bg: '#ede9fe' },
  { name: 'pink',    value: '#ec4899', bg: '#fce7f3' },
  { name: 'teal',    value: '#14b8a6', bg: '#ccfbf1' },
  { name: 'orange',  value: '#f97316', bg: '#ffedd5' },
  { name: 'indigo',  value: '#6366f1', bg: '#e0e7ff' },
  { name: 'cyan',    value: '#06b6d4', bg: '#cffafe' },
  { name: 'lime',    value: '#84cc16', bg: '#ecfccb' },
  { name: 'rose',    value: '#e11d48', bg: '#ffe4e6' },
];

export interface Project {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  color: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  isErp?: boolean;
}

export interface ScheduledShift {
  id: string;
  userId: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  shiftName: string | null;
  projectId: string | null;
  role: string | null;
  notes: string | null;
  status: string;
  createdBy: string | null;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Resolved locally
  project?: Project | null;
  profiles?: { full_name: string } | null;
  // snake_case aliases for legacy component compat
  user_id?: string;
  shift_date?: string;
  shift_start?: string;
  shift_end?: string;
  shift_name?: string | null;
  project_id?: string | null;
  clock_entry_id?: string | null;
  created_by?: string | null;
  last_edited_by?: string | null;
  created_at?: string;
  updated_at?: string;
  notion_page_id?: string | null;
}

/** Inject snake_case aliases into a shift for legacy components */
function addSnakeCase(s: ScheduledShift): ScheduledShift {
  return {
    ...s,
    user_id: s.userId,
    shift_date: s.shiftDate,
    shift_start: s.shiftStart,
    shift_end: s.shiftEnd,
    shift_name: s.shiftName,
    project_id: s.projectId,
    created_by: s.createdBy,
    last_edited_by: s.lastEditedBy,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    clock_entry_id: null,
    notion_page_id: null,
  };
}

export function useScheduledShifts() {
  const [rawShifts, setRawShifts] = useState<ScheduledShift[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { isAdmin, isManager, userId } = useUserRoles();

  const canManage = isAdmin || isManager;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsData, projectsData, erpProjectsData, employeesData] = await Promise.all([
        hrList<ScheduledShift>('shifts'),
        hrList<Project>('projects'),
        hrList<{ id: string; name: string }>('erp-projects').catch(() => []),
        hrList<{ id: string; firstName: string; lastName: string }>('employees').catch(() => []),
      ]);

      // Normalize ERP projects to match Project interface
      const normalizedErpProjects: Project[] = erpProjectsData.map(p => ({
        id: p.id,
        name: `[ERP] ${p.name}`,
        address: null,
        latitude: null,
        longitude: null,
        color: 'indigo', // Default color for ERP projects
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isErp: true, // Tag for UI
      }));

      const allProjects = [...projectsData, ...normalizedErpProjects];
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const employeeMap = new Map(employeesData.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

      const enriched = shiftsData.map(s => addSnakeCase({
        ...s,
        project: s.projectId ? projectMap.get(s.projectId) || null : null,
        profiles: s.userId && employeeMap.has(s.userId)
          ? { full_name: employeeMap.get(s.userId)! }
          : s.profiles || null,
      }));

      setRawShifts(enriched);
      setProjects(allProjects);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Legacy alias
  const shifts = rawShifts;

  const createShift = useCallback(async (data: Partial<ScheduledShift>) => {
    // Normalize snake_case input from legacy components
    const normalized: Record<string, any> = { ...data };
    if ('user_id' in data && !data.userId) normalized.userId = data.user_id;
    if ('shift_date' in data && !data.shiftDate) normalized.shiftDate = data.shift_date;
    if ('shift_start' in data && !data.shiftStart) normalized.shiftStart = data.shift_start;
    if ('shift_end' in data && !data.shiftEnd) normalized.shiftEnd = data.shift_end;
    if ('shift_name' in data && !data.shiftName) normalized.shiftName = data.shift_name;
    if ('project_id' in data && !data.projectId) normalized.projectId = data.project_id;

    try {
      const shift = await hrCreate<ScheduledShift>('shifts', normalized);
      setRawShifts(prev => [addSnakeCase(shift), ...prev]);
      return { data: addSnakeCase(shift), error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const updateShift = useCallback(async (id: string, data: Partial<ScheduledShift>) => {
    // Same normalization
    const normalized: Record<string, any> = { ...data };
    if ('user_id' in data && !data.userId) normalized.userId = data.user_id;
    if ('shift_date' in data && !data.shiftDate) normalized.shiftDate = data.shift_date;
    if ('shift_start' in data && !data.shiftStart) normalized.shiftStart = data.shift_start;
    if ('shift_end' in data && !data.shiftEnd) normalized.shiftEnd = data.shift_end;
    if ('shift_name' in data && !data.shiftName) normalized.shiftName = data.shift_name;
    if ('project_id' in data && !data.projectId) normalized.projectId = data.project_id;

    try {
      const shift = await hrUpdate<ScheduledShift>('shifts', id, normalized);
      setRawShifts(prev => prev.map(s => s.id === id ? addSnakeCase({ ...s, ...shift }) : s));
      return { data: addSnakeCase(shift), error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const updateShiftStatus = useCallback(async (id: string, status: string) => {
    return updateShift(id, { status });
  }, [updateShift]);

  const deleteShift = useCallback(async (id: string) => {
    try {
      await hrDelete('shifts', id);
      setRawShifts(prev => prev.filter(s => s.id !== id));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  const getTodayShift = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return shifts.find(s => s.shiftDate === today && s.userId === userId) || null;
  }, [shifts, userId]);

  const createUserShift = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return createShift({
      userId,
      shiftDate: today,
      shiftStart: timeStr,
      shiftEnd: '17:00',
      status: 'in-progress',
    });
  }, [createShift, userId]);

  const completeUserShift = useCallback(async (shiftId: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return updateShift(shiftId, { shiftEnd: timeStr, status: 'completed' });
  }, [updateShift]);

  const createProject = useCallback(async (nameOrData: string | Partial<Project>, address?: string | null, color?: string) => {
    // Support both legacy (name, address, color) and new ({ name, address, color }) signatures
    // Resolve color name → hex value for storage
    const resolveColor = (c?: string) => {
      if (!c) return NOTION_COLORS[0].value;
      const found = NOTION_COLORS.find(nc => nc.name === c || nc.value === c);
      return found ? found.value : c;
    };
    const data: Partial<Project> = typeof nameOrData === 'string'
      ? { name: nameOrData, address: address || null, color: resolveColor(color) }
      : { ...nameOrData, color: resolveColor(nameOrData.color) };

    try {
      const project = await hrCreate<Project>('projects', data);
      setProjects(prev => [project, ...prev]);
      return { data: project, error: null };
    } catch (err: any) {
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
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  return {
    shifts,
    projects,
    loading,
    error,
    canManage,
    createShift,
    updateShift,
    updateShiftStatus,
    deleteShift,
    getTodayShift,
    createUserShift,
    completeUserShift,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchAll,
  };
}
