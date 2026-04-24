"use client";
import { useState, useEffect, useMemo } from 'react';
import { Loader2, LayoutList, LayoutGrid } from 'lucide-react';
import { ScheduleTable } from '@/components/time-tracker/components/schedule/ScheduleTable';
import { ScheduleMatrixView } from '@/components/time-tracker/components/schedule/ScheduleMatrixView';
import { CreateShiftForm } from '@/components/time-tracker/components/schedule/CreateShiftForm';
import { EditShiftDialog } from '@/components/time-tracker/components/schedule/EditShiftDialog';
import { useScheduledShifts, ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useDatabaseStore } from '@/components/admin/database/store';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';

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

  const hrDb = useDatabaseStore(state => state.databases.find(db => db.id === 'db-hr'));

  useEffect(() => {
    const fetchWorkers = async () => {
      if (hrDb) {
        const activeWorkers = hrDb.pages
          .filter(page => page.properties['prop-hr-status'] === 'opt-active')
          .map(page => ({
            id: page.id,
            full_name: String(page.properties['title'] || 'Unknown'),
            hourly_rate: 0
          }));

        activeWorkers.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setWorkers(activeWorkers);
      }
    };

    fetchWorkers();
  }, [hrDb]);

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
