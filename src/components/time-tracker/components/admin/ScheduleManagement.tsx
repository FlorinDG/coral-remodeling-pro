"use client";
import { useState, useEffect, useMemo } from 'react';
import { Loader2, LayoutList, LayoutGrid } from 'lucide-react';
import { ScheduleTable } from '@/components/time-tracker/components/schedule/ScheduleTable';
import { ScheduleMatrixView } from '@/components/time-tracker/components/schedule/ScheduleMatrixView';
import { CreateShiftForm } from '@/components/time-tracker/components/schedule/CreateShiftForm';
import { EditShiftDialog } from '@/components/time-tracker/components/schedule/EditShiftDialog';
import { useScheduledShifts, ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hrList } from '@/components/time-tracker/lib/hr-api';

interface WorkerOption {
  id: string;
  full_name: string;
  hourly_rate?: number | null;
}

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
  const { shifts, projects, loading, createShift, createProject, updateShift, updateShiftStatus, deleteShift, canManage } = useScheduledShifts();
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [weekCount, setWeekCount] = useState<1 | 2>(1);
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
          firstName: string;
          lastName: string;
          status: string;
          hourlyCost: number | null;
        }>('employees');

        const activeWorkers = employees
          .filter(e => e.status === 'ACTIVE')
          .map(e => ({
            id: e.id,
            full_name: `${e.firstName} ${e.lastName}`,
            hourly_rate: e.hourlyCost,
          }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));

        setWorkers(activeWorkers);
      } catch (err) {
        console.error('[ScheduleManagement] Failed to fetch employees:', err);
      }
    };

    fetchWorkers();
  }, []);

  const handleDelete = async (shiftId: string) => {
    try {
      await deleteShift(shiftId);
      toast.success('Shift deleted');
    } catch {
      toast.error('Failed to delete shift');
    }
  };

  const handleStatusChange = async (shiftId: string, status: string) => {
    try {
      await updateShiftStatus(shiftId, status);
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
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
      await updateShift(shiftId, { user_id: newUserId, shift_date: newDate });
      toast.success('Shift rescheduled');
    } catch {
      toast.error('Failed to reschedule shift');
    }
  };

  const handleShiftClick = (shift: ScheduledShift) => {
    setEditingShift(shift);
    setEditDialogOpen(true);
  };

  const handleUpdateShift = async (shiftId: string, updates: Parameters<typeof updateShift>[1]) => {
    await updateShift(shiftId, updates);
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
    const sourceStartStr = sourceWeekStart.toISOString().split('T')[0];
    const sourceEndStr = sourceEnd.toISOString().split('T')[0];

    const sourceShifts = shifts.filter(s => {
      const d = s.shiftDate || s.shift_date || '';
      return d >= sourceStartStr && d <= sourceEndStr;
    });

    if (sourceShifts.length === 0) {
      toast.error('No shifts found in the previous week to copy');
      return;
    }

    // Calculate the day offset
    const dayOffset = Math.round((targetWeekStart.getTime() - sourceWeekStart.getTime()) / (1000 * 60 * 60 * 24));

    let created = 0;
    for (const shift of sourceShifts) {
      const srcDate = new Date(shift.shiftDate || shift.shift_date || '');
      const newDate = new Date(srcDate);
      newDate.setDate(newDate.getDate() + dayOffset);
      const newDateStr = newDate.toISOString().split('T')[0];

      // Check if a shift already exists for this user on this date
      const alreadyExists = shifts.some(s => {
        const uid = s.userId || s.user_id || '';
        const sd = s.shiftDate || s.shift_date || '';
        return uid === (shift.userId || shift.user_id) && sd === newDateStr;
      });
      if (alreadyExists) continue;

      await createShift({
        user_id: shift.userId || shift.user_id || '',
        project_id: shift.projectId || shift.project_id || null,
        shift_date: newDateStr,
        shift_start: shift.shiftStart || shift.shift_start || '08:00',
        shift_end: shift.shiftEnd || shift.shift_end || '17:00',
        role: shift.role || null,
        notes: shift.notes || null,
      });
      created++;
    }

    toast.success(`Copied ${created} shift(s) from previous week`);
  };


  // Filter shifts for the matrix view date range
  const matrixShifts = useMemo(() => {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + (weekCount * 7) - 1);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    return shifts.filter(s => {
      const d = s.shiftDate || s.shift_date || '';
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
          <span className="text-sm text-muted-foreground">View:</span>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">
                <div className="flex items-center gap-2">
                  <LayoutList className="h-4 w-4" />
                  <span>Table</span>
                </div>
              </SelectItem>
              <SelectItem value="matrix">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>Matrix</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <>
            <CreateShiftForm
              projects={projects}
              workers={workers}
              onCreateShift={createShift}
              onCreateProject={createProject}
            />
            {/* Hidden controlled CreateShiftForm for matrix plus button */}
            <CreateShiftForm
              projects={projects}
              workers={workers}
              onCreateShift={createShift}
              onCreateProject={createProject}
              open={createShiftDialogOpen}
              onOpenChange={setCreateShiftDialogOpen}
              prefilledUserId={prefilledUserId}
              prefilledDate={prefilledDate}
              onClose={handleCreateShiftDialogClose}
            />
          </>
        )}
      </div>

      {viewMode === 'table' ? (
        <ScheduleTable
          shifts={shifts}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onShiftClick={handleShiftClick}
          canManage={canManage}
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
        onStatusChange={handleStatusChange}
        canManage={canManage}
      />
    </div>
  );
}
