"use client";
import { useState, useEffect, useMemo } from 'react';
import { Loader2, LayoutList, LayoutGrid } from 'lucide-react';
import { ScheduleTable } from '@/components/time-tracker/components/schedule/ScheduleTable';
import { ScheduleMatrixView } from '@/components/time-tracker/components/schedule/ScheduleMatrixView';
import { CreateShiftForm, EditShiftDialog } from '@/components/time-tracker/components/schedule/shift-editor';
import type { EditScope } from '@/components/ui/ScopePicker';
import { describeError } from '@/lib/describe-error';
import { localDateKey, shiftMoment } from '@/lib/kernel/shift-time';
import { leaveConflicts } from '@/lib/kernel/absence';
import { useScheduledShifts, ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hrList } from '@/lib/hr-api';
import { WorkerOption } from '@/components/time-tracker/types/timesheet';
import { useTranslations } from 'next-intl';

type ViewMode = 'table' | 'matrix';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function ScheduleManagement() {
  const t = useTranslations('Hr.scheduler');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [weekCount, setWeekCount] = useState<1 | 2>(1);
  // SCHED-WINDOW-1: the planner loads the weeks on screen ± one week (copy-previous-week reads the week before).
  const { shifts, projects, absences, loading, createShift, createLeave, updateShift, updateShiftStatus, deleteShift, canManage } = useScheduledShifts({ kind: 'planner', weekStart: localDateKey(weekStart), weeks: weekCount });
  // LEAVE-1 (Florin 2026-10-08): a shift planned on a day its worker is off is a conflict — flagged everywhere it shows.
  const conflicts = useMemo(() => leaveConflicts(shifts, absences), [shifts, absences]);
  const conflictIds = useMemo(() => new Set(conflicts.map(c => c.shiftId)), [conflicts]);
  const [workers, setWorkers] = useState<WorkerOption[]>([
    {
      id: 'unassigned',
      name: t('unassignedShifts'),
      hourlyRate: 0,
    }
  ]);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [editingShift, setEditingShift] = useState<ScheduledShift | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // State for matrix add shift popup
  const [createShiftDialogOpen, setCreateShiftDialogOpen] = useState(false);
  const [prefilledUserId, setPrefilledUserId] = useState<string | undefined>();
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>();

  // Fetch employees from the Employee table (tenant-scoped via API)
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const employees = await hrList<{
          id: string;
          userId?: string | null;
          firstName: string;
          lastName: string;
          status: string;
          hourlyCost: number | null;
          schedule?: boolean;
        }>('employees');

        const activeWorkers = employees
          .filter(e => e.schedule !== false && e.userId) // Only employees with linked user accounts
          .map(e => ({
            id: e.userId!, // Use User.id, not Employee.id
            name: `${e.firstName} ${e.lastName}`,
            hourlyRate: e.hourlyCost,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const unassignedWorker = {
          id: 'unassigned',
          name: t('unassignedShifts'),
          hourlyRate: 0,
        };

        setWorkers([unassignedWorker, ...activeWorkers]);
      } catch (err) {
        console.error('[ScheduleManagement] Failed to fetch employees:', err);
      }
    };

    fetchWorkers();
  }, [t]);

  // SCH-8: the scope reaches the server; the count makes a silent no-op impossible.
  const handleDelete = async (shiftId: string, scope?: EditScope) => {
    const res = await deleteShift(shiftId, scope);
    if (res.error) { toast.error(t('failedToDelete', { error: describeError(res.error) })); throw res.error; }
    toast.success(res.deleted > 1 || res.kept
      ? t('shiftsDeleted', { deleted: res.deleted, kept: res.kept ? t('keptHoursLogged', { kept: res.kept }) : '' })
      : t('shiftDeleted'));
  };

  const handleStatusChange = async (shiftId: string, status: string) => {
    try {
      await updateShiftStatus(shiftId, status);
      toast.success(t('statusUpdated'));
    } catch {
      toast.error(t('failedToUpdateStatus'));
    }
  };

  const handlePrevWeek = () => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const handleNextWeek = () => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  const handleShiftMove = async (shiftId: string, newUserId: string, newDate: string) => {
    try {
      await updateShift(shiftId, { userId: newUserId, shiftDate: newDate });
      toast.success(t('shiftRescheduled'));
    } catch {
      toast.error(t('failedToReschedule'));
    }
  };

  const handleShiftClick = (shift: ScheduledShift) => {
    setEditingShift(shift);
    setEditDialogOpen(true);
  };

  const handleUpdateShift = async (shiftId: string, updates: Parameters<typeof updateShift>[1], scope?: EditScope) => {
    const res = await updateShift(shiftId, updates, scope);
    if (res.error) throw res.error;   // EditShiftDialog shows the failure
    const n = (res.data as { seriesUpdated?: number } | null)?.seriesUpdated;
    if (n && n > 1) toast.success(t('shiftsUpdated', { count: n }));
  };

  const handleAddShift = (userId: string, date: string) => {
    // Open the create shift dialog with prefilled values
    setPrefilledUserId(userId);
    setPrefilledDate(date);
    setCreateShiftDialogOpen(true);
  };

  const handleCreateShiftDialogClose = () => {
    setCreateShiftDialogOpen(false);
    setPrefilledUserId(undefined);
    setPrefilledDate(undefined);
  };

  const handleCopyWeek = async (sourceWeekStart: Date, targetWeekStart: Date) => {
    // Find all shifts in the source week
    const sourceEnd = new Date(sourceWeekStart);
    sourceEnd.setDate(sourceEnd.getDate() + 6);
    // Local dates (toISOString is UTC — the week's Sunday fell outside the window and was never copied).
    const sourceStartStr = localDateKey(sourceWeekStart);
    const sourceEndStr = localDateKey(sourceEnd);

    const sourceShifts = shifts.filter(s => {
      const d = s.shiftDate || '';
      return d >= sourceStartStr && d <= sourceEndStr;
    });

    if (sourceShifts.length === 0) {
      toast.error(t('noShiftsInPrevWeek'));
      return;
    }

    // Calculate the day offset
    const dayOffset = Math.round((targetWeekStart.getTime() - sourceWeekStart.getTime()) / (1000 * 60 * 60 * 24));

    let created = 0;
    for (const shift of sourceShifts) {
      const newDate = shiftMoment(shift.shiftDate || '', '12:00');   // local noon: no DST/UTC edge
      newDate.setDate(newDate.getDate() + dayOffset);
      const newDateStr = localDateKey(newDate);

      // Check if a shift already exists for this user on this date
      const alreadyExists = shifts.some(s => {
        const uid = s.userId || '';
        const sd = s.shiftDate || '';
        return uid === shift.userId && sd === newDateStr;
      });
      if (alreadyExists) continue;

      await createShift({
        userId: shift.userId || '',
        projectId: shift.projectId || null,
        shiftDate: newDateStr,
        shiftStart: shift.shiftStart || '08:00',
        shiftEnd: shift.shiftEnd || '17:00',
        role: shift.role || null,
        notes: shift.notes || null,
      });
      created++;
    }

    toast.success(t('copiedFromPrevWeek', { count: created }));
  };


  // Filter shifts for the matrix view date range
  const matrixShifts = useMemo(() => {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + (weekCount * 7) - 1);

    // Local dates — toISOString() is UTC: Monday 00:00 in Belgium is Sunday 22:00Z, which shifted the
    // window a day back and dropped the week's Sunday from the matrix.
    const startStr = localDateKey(weekStart);
    const endStr = localDateKey(endDate);

    return shifts.filter(s => {
      const d = s.shiftDate || '';
      return d >= startStr && d <= endStr;
    });
  }, [shifts, weekStart, weekCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('view')}</span>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">
                <div className="flex items-center gap-2">
                  <LayoutList className="h-4 w-4" />
                  <span>{t('table')}</span>
                </div>
              </SelectItem>
              <SelectItem value="matrix">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>{t('matrix')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <div className="hidden md:block">
            <CreateShiftForm
              projects={projects}
              workers={workers}
              onCreateShift={createShift}
              onCreateLeave={createLeave}
              absences={absences}
            />
            {/* Hidden controlled CreateShiftForm for matrix plus button */}
            <CreateShiftForm
              projects={projects}
              workers={workers}
              onCreateShift={createShift}
              onCreateLeave={createLeave}
              absences={absences}
              open={createShiftDialogOpen}
              onOpenChange={setCreateShiftDialogOpen}
              prefilledUserId={prefilledUserId}
              prefilledDate={prefilledDate}
              onClose={handleCreateShiftDialogClose}
            />
          </div>
        )}
      </div>

      {viewMode === 'table' ? (
        <ScheduleTable
          shifts={matrixShifts}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onShiftClick={handleShiftClick}
          canManage={canManage}
          conflictIds={conflictIds}
        />
      ) : (
        <ScheduleMatrixView
          shifts={matrixShifts}
          workers={workers}
          weekStart={weekStart}
          weekCount={weekCount}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onWeekCountChange={setWeekCount}
          onShiftMove={handleShiftMove}
          onShiftClick={handleShiftClick}
          onAddShift={handleAddShift}
          onCopyWeek={handleCopyWeek}
          canManage={canManage}
          absences={absences}
          conflictIds={conflictIds}
        />
      )}

      <EditShiftDialog
        shift={editingShift}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        projects={projects}
        workers={workers}
        onUpdateShift={handleUpdateShift}
        onDeleteShift={handleDelete}
        onCreateShift={createShift}
        onStatusChange={handleStatusChange}
        canManage={canManage}
        leaveConflict={editingShift ? (conflicts.find(c => c.shiftId === editingShift.id) ?? null) : null}
      />
    </div>
  );
}
