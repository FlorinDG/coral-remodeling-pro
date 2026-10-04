"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/lib/hr-api';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { pickShiftNow, localDateKey, isShiftSubmitted } from '@/lib/kernel/shift-time';

export const NOTION_COLORS = [
  { name: 'blue',    value: '#3b82f6', bg: '#dbeafe' },
  { name: 'red',     value: '#ef4444', bg: '#fee2e2' },
  { name: 'amber',   value: '#f59e0b', bg: '#fef3c7' },
  { name: 'green',   value: '#339989', bg: '#33998920' },
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
  seriesId?: string | null;
  // Synthetic absence block fields
  isSynthetic?: boolean;
  sourceType?: string;
  sourceId?: string;
  // Enriched fields
  projectName?: string;
  userName?: string;
  clockEntries?: any[];

  // --- DECLARED BRIDGE (INC-1 / TD-5) ---
  // Legacy snake_case aliases.
  // EXIT CONDITION (TD-5): Removed ONLY when the last reader is converted in TD-4.
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

/**
 * DECLARED BRIDGE — INC-1 (2026-09-28)
 * Restores snake_case aliases for legacy shift readers across the 12 shift-consuming files
 * currently carrying @ts-nocheck.
 * 
 * EXIT CONDITION (TD-5):
 * This bridge is removed ONLY when the last reader is converted to camelCase in TD-4,
 * verified via `grep "SUPA-2: .*shift_" src/` returning 0 hits.
 */
function addSnakeCase(s: ScheduledShift): ScheduledShift {
  return {
    ...s,
    user_id: s.userId,
    shift_date: s.shiftDate,
    shift_start: s.shiftStart,
    shift_end: s.shiftEnd,
    shift_name: s.shiftName,
    project_id: s.projectId,
    created_at: s.createdAt,
    created_by: s.createdBy,
    last_edited_by: s.lastEditedBy,
    updated_at: s.updatedAt,
  };
}

export function useScheduledShifts() {
  const [rawShifts, setRawShifts] = useState<ScheduledShift[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const [failedEndpoints, setFailedEndpoints] = useState<string[]>([]);
  const { isAdmin, isManager, userId } = useUserRoles();

  const canManage = isAdmin || isManager;

  // The project list, readable from the save callbacks: a saved shift is re-joined to its project so
  // the scheduler shows the new project at once (it kept the old one until a reload — Florin 2026-10-01).
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;
  const withProject = useCallback((s: ScheduledShift): ScheduledShift => {
    const pid = s.projectId ?? null;
    const project = pid ? projectsRef.current.find(p => p.id === pid) || null : null;
    return { ...s, project, projectName: project?.name } as ScheduledShift;
  }, []);

  // Every local change (create / update / delete) bumps this. A reload that STARTED before a change
  // carries the old list — applying it put a just-deleted shift back on screen until a refresh
  // (Florin 2026-10-02). Such a reload is discarded and run again.
  const mutationSeq = useRef(0);

  /** `silent`: refresh without the loading state (no flash) — used when the tab regains focus. */
  const fetchAll = useCallback(async (silent = false): Promise<void> => {
    const startedAt = mutationSeq.current;
    if (!silent) setLoading(true);
    const withTimeout = <T>(p: Promise<T>, ms = 9000, name: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)),
      ]);

    const results = await Promise.allSettled([
      withTimeout(hrList<ScheduledShift>('shifts'), 9000, 'shifts'),
      // PROJ-SSOT-1: the HrProject list ('projects') is gone — one project source, one fewer call to fail.
      withTimeout(hrList<{ id: string; name: string; address?: string; latitude?: number; longitude?: number }>('erp-projects'), 9000, 'erp-projects'),
      withTimeout(hrList<{ id: string; userId?: string | null; firstName: string; lastName: string }>('employees'), 9000, 'employees'),
      withTimeout(hrList<any>('time-off'), 9000, 'time-off'),
    ]);

    const [shiftsRes, erpProjectsRes, employeesRes] = results;
    if (mutationSeq.current !== startedAt) {
      // A change landed while this reload was on the wire — its list is stale.
      return fetchAll(true);
    }

    const currentErrors: Record<string, Error> = {};
    const failed: string[] = [];
    const endpointNames = ['shifts', 'erp-projects', 'employees', 'time-off'] as const;

    results.forEach((res, i) => {
      if (res.status === 'rejected') {
        const name = endpointNames[i];
        failed.push(name);
        currentErrors[name] = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
      }
    });

    setErrors(currentErrors);
    setFailedEndpoints(failed);

    if (shiftsRes.status === 'rejected') {
      setError(shiftsRes.reason instanceof Error ? shiftsRes.reason : new Error(String(shiftsRes.reason)));
    } else if (failed.length > 0) {
      setError(currentErrors[failed[0]]);
    } else {
      setError(null);
    }

    // Projects: graceful degradation
    const erpProjectsData = erpProjectsRes.status === 'fulfilled' ? erpProjectsRes.value : [];

    const normalizedErpProjects: Project[] = erpProjectsData.map(p => ({
      id: p.id,
      name: p.name,   // PROJ-SSOT-1: no "[ERP] " prefix — there is one kind of project
      address: p.address || null,
      latitude: p.latitude || null,
      longitude: p.longitude || null,
      color: 'indigo',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isErp: true,
    }));

    const allProjects = normalizedErpProjects;
    const projectMap = new Map(allProjects.map(p => [p.id, p]));

    // Employees lookup: graceful degradation
    const employeesData = employeesRes.status === 'fulfilled' ? employeesRes.value : [];
    const employeeMap = new Map<string, string>();
    employeesData.forEach(e => {
      const name = `${e.firstName} ${e.lastName}`;
      if (e.userId) employeeMap.set(e.userId, name);
      employeeMap.set(e.id, name);
    });

    // Shifts: render if fulfilled, even if other lookups failed
    if (shiftsRes.status === 'fulfilled') {
      const shiftsData = shiftsRes.value;
      const enriched = shiftsData.map(s => addSnakeCase({
        ...s,
        project: s.projectId ? projectMap.get(s.projectId) || null : null,
        userName: (s as any).userName || (s.userId ? employeeMap.get(s.userId) : undefined) || employeeMap.get((s as any).user_id || '') || 'Onbekend',
      }));
      setRawShifts(enriched);
    }
    // WHS-1b §3: on a shifts failure keep what is already on screen — a failed REFETCH must not
    // blank a week that loaded. The banner (failedEndpoints) says the data could not be refreshed.

    setProjects(allProjects);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Another screen (the WorkHub, another tab, a colleague) may have changed shifts: refresh quietly
  // when this tab comes back into view, instead of waiting for a manual reload.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 15_000) return;
      last = Date.now();
      void fetchAll(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [fetchAll]);

  // Legacy alias
  const shifts = rawShifts;

  const createShift = useCallback(async (data: Partial<ScheduledShift>) => {
    // Normalize snake_case input from legacy components
    const normalized: Record<string, any> = { ...data };
    if ('user_id' in data) { if (!data.userId) normalized.userId = data.user_id; delete normalized.user_id; }
    if ('shift_date' in data) { if (!data.shiftDate) normalized.shiftDate = data.shift_date; delete normalized.shift_date; }
    if ('shift_start' in data) { if (!data.shiftStart) normalized.shiftStart = data.shift_start; delete normalized.shift_start; }
    if ('shift_end' in data) { if (!data.shiftEnd) normalized.shiftEnd = data.shift_end; delete normalized.shift_end; }
    if ('shift_name' in data) { if (!data.shiftName) normalized.shiftName = data.shift_name; delete normalized.shift_name; }
    if ('project_id' in data) { if (!data.projectId) normalized.projectId = data.project_id; delete normalized.project_id; }

    mutationSeq.current++;
    try {
      const shift = await hrCreate<ScheduledShift>('shifts', normalized);
      setRawShifts(prev => [addSnakeCase(withProject(shift)), ...prev]);
      // Removed void fetchAll() to prevent matrix flash
      return { data: addSnakeCase(shift), error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, [withProject, fetchAll]);

  /** `scope` (SCH-8): 'following' | 'series' are applied by the SERVER in one statement; the
   *  screen then reloads, and `seriesUpdated` says how many shifts changed. */
  const updateShift = useCallback(async (id: string, data: Partial<ScheduledShift>, scope?: 'occurrence' | 'following' | 'series') => {
    const normalized: Record<string, any> = { ...data };
    if ('user_id' in data) { if (!data.userId) normalized.userId = data.user_id; delete normalized.user_id; }
    if ('shift_date' in data) { if (!data.shiftDate) normalized.shiftDate = data.shift_date; delete normalized.shift_date; }
    if ('shift_start' in data) { if (!data.shiftStart) normalized.shiftStart = data.shift_start; delete normalized.shift_start; }
    if ('shift_end' in data) { if (!data.shiftEnd) normalized.shiftEnd = data.shift_end; delete normalized.shift_end; }
    if ('shift_name' in data) { if (!data.shiftName) normalized.shiftName = data.shift_name; delete normalized.shift_name; }
    if ('project_id' in data) { if (!data.projectId) normalized.projectId = data.project_id; delete normalized.project_id; }

    mutationSeq.current++;
    try {
      // Optimistic update
      setRawShifts(prev => prev.map(s => s.id === id ? addSnakeCase(withProject({ ...s, ...normalized })) : s));

      const shift = await hrUpdate<ScheduledShift & { seriesUpdated?: number }>('shifts', id, normalized, scope);
      setRawShifts(prev => prev.map(s => s.id === id ? addSnakeCase(withProject({ ...s, ...shift })) : s));
      if (scope && scope !== 'occurrence') void fetchAll(true);
      // Removing fetchAll() here to prevent full redraws. The background sync or other hooks will handle refresh if needed.
      // void fetchAll();
      return { data: addSnakeCase(shift), error: null };
    } catch (err: any) {
      // Revert on error (could be improved by keeping old state)
      void fetchAll();
      return { data: null, error: err };
    }
  }, [withProject, fetchAll]);

  const updateShiftStatus = useCallback(async (id: string, status: string) => {
    return updateShift(id, { status });
  }, [updateShift]);

  const deleteShift = useCallback(async (id: string, scope?: 'occurrence' | 'following' | 'series') => {
    mutationSeq.current++;
    try {
      const res = await hrDelete<{ seriesDeleted?: number; seriesKept?: number }>('shifts', id, scope);
      setRawShifts(prev => prev.filter(s => s.id !== id));
      if (scope && scope !== 'occurrence') void fetchAll(true);
      return { error: null, deleted: res?.seriesDeleted ?? 1, kept: res?.seriesKept ?? 0 };
    } catch (err: any) {
      return { error: err, deleted: 0, kept: 0 };
    }
  }, [fetchAll]);

  // The shift that is NOW for this worker (kernel/shift-time): running, else next today, else last today.
  // Was `.find()` over createdAt order — with two shifts in a day it returned the later-created one —
  // and "today" was toISOString() (UTC), i.e. yesterday between 00:00 and 02:00 in Belgium.
  const getTodayShift = useCallback(() => {
    // A SUBMITTED shift is closed to clocking — it is never "now".
    return pickShiftNow(shifts.filter(s => s.userId === userId && !isShiftSubmitted(s.status)), new Date());
  }, [shifts, userId]);

  // createUserShift / completeUserShift REMOVED (Florin 2026-10-04): NO ad-hoc shifts. A clock-in without a
  // planned shift is recorded as such, pending approval; the admin may plan a shift in the past to match it.

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
    errors,
    failedEndpoints,
    canManage,
    createShift,
    updateShift,
    updateShiftStatus,
    deleteShift,
    getTodayShift,
    createProject,
    updateProject,
    deleteProject,
    refetch: () => fetchAll(),
  };
}
