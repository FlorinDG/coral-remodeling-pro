"use client";
/**
 * GRID-SURFACE-1 · ScheduleTable in the ONE grid.
 *
 * Renders shifts through DataGridSurface:
 * Datum · Tijd · Medewerker · Project · Adres · Rol · Status (kernel select, in-progress never chosen) · conflict mark.
 */
import { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';
import { cn } from '@/lib/utils';
import { isWritableShiftStatus, SHIFT_STATUS_OPTIONS } from '@/lib/kernel/shift-status';
import { zonedParts } from '@/lib/kernel/shift-time';
import { SHIFT_STATUS_PILL, getShiftStatusLabel } from './shift-status-ui';
import { useLocale, useTranslations } from 'next-intl';
import DataGridSurface from '@/components/admin/database/v2/DataGridSurface';
import {
  mapShiftToGridRow,
  type SchedulerGridRow,
} from './schedule-grid-model';

interface ScheduleTableProps {
  shifts: ScheduledShift[];
  onDelete?: (shiftId: string) => void;
  onStatusChange?: (shiftId: string, status: string) => void;
  onShiftClick?: (shift: ScheduledShift) => void;
  canManage?: boolean;
  /** Shifts planned on a day their worker is off (kernel/absence leaveConflicts). */
  conflictIds?: Set<string>;
}

export function ScheduleTable({
  shifts,
  onDelete,
  onStatusChange,
  onShiftClick,
  canManage,
  conflictIds,
}: ScheduleTableProps) {
  const t = useTranslations('Hr.scheduler');
  const tShifts = useTranslations('Hr.shifts');
  const locale = useLocale();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const today = zonedParts(new Date()).date;

  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => {
      const d = shift.shiftDate || '';
      if (filter === 'upcoming') return d >= today;
      if (filter === 'past') return d < today;
      return true;
    });
  }, [shifts, filter, today]);

  const rows = useMemo<SchedulerGridRow[]>(() => {
    return filteredShifts.map(s =>
      mapShiftToGridRow(s, {
        locale,
        tShifts: (k: string) => tShifts(k),
        conflictIds,
      })
    );
  }, [filteredShifts, locale, tShifts, conflictIds]);

  const columns = useMemo<ColumnDef<SchedulerGridRow>[]>(() => {
    const cols: ColumnDef<SchedulerGridRow>[] = [
      {
        id: 'shiftDate',
        header: () => <span className="truncate">{t('colDate')}</span>,
        size: 140,
        cell: ({ row }) => (
          <div className="w-full h-full px-2 flex items-center text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {row.original.formattedDate}
          </div>
        ),
      },
      {
        id: 'time',
        header: () => <span className="truncate">{t('colTime')}</span>,
        size: 130,
        cell: ({ row }) => (
          <div className="w-full h-full px-2 flex items-center text-sm text-neutral-700 dark:text-neutral-300 truncate font-mono text-xs">
            {row.original.timeRange}
          </div>
        ),
      },
      {
        id: 'worker',
        header: () => <span className="truncate">{t('colEmployee')}</span>,
        size: 160,
        cell: ({ row }) => (
          <div className="w-full h-full px-2 flex items-center text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {row.original.workerName}
          </div>
        ),
      },
      {
        id: 'project',
        header: () => <span className="truncate">{t('colProject')}</span>,
        size: 180,
        cell: ({ row }) => {
          const { project, projectColor } = row.original;
          if (!project) {
            return <div className="w-full h-full px-2 flex items-center text-sm text-neutral-400">—</div>;
          }
          return (
            <div className="w-full h-full px-2 flex items-center truncate">
              <span
                className="px-2 py-0.5 rounded text-xs truncate max-w-full font-medium"
                style={projectColor ? {
                  backgroundColor: projectColor.bg,
                  color: projectColor.value,
                } : undefined}
              >
                {project.name}
              </span>
            </div>
          );
        },
      },
      {
        id: 'address',
        header: () => <span className="truncate">{t('colLocation')}</span>,
        size: 180,
        cell: ({ row }) => (
          <div className="w-full h-full px-2 flex items-center text-sm text-neutral-600 dark:text-neutral-400 truncate" title={row.original.address}>
            {row.original.address}
          </div>
        ),
      },
      {
        id: 'role',
        header: () => <span className="truncate">{t('colRole')}</span>,
        size: 130,
        cell: ({ row }) => (
          <div className="w-full h-full px-2 flex items-center text-sm text-neutral-600 dark:text-neutral-400 truncate">
            {row.original.formattedRole}
          </div>
        ),
      },
      {
        id: 'status',
        header: () => <span className="truncate">{t('colStatus')}</span>,
        size: 180,
        cell: ({ row }) => {
          const { id, status, isConflict } = row.original;
          return (
            <div className="w-full h-full px-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {canManage && onStatusChange ? (
                <Select
                  value={status}
                  onValueChange={(v) => { if (isWritableShiftStatus(v)) onStatusChange(id, v); }}
                >
                  <SelectTrigger className={cn("w-32 h-7 text-xs", SHIFT_STATUS_PILL[status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} disabled={!isWritableShiftStatus(s)}>
                        {getShiftStatusLabel(s, (k) => tShifts(k))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", SHIFT_STATUS_PILL[status])}>
                  {getShiftStatusLabel(status, (k) => tShifts(k))}
                </span>
              )}
              {isConflict && (
                <span className="text-[10px] font-bold text-red-600 shrink-0" title={t('leaveConflictTitle')}>
                  {t('leaveBadge')}
                </span>
              )}
            </div>
          );
        },
      },
    ];

    if (canManage) {
      cols.push({
        id: 'actions',
        header: () => <span className="truncate">{t('colActions')}</span>,
        size: 70,
        cell: ({ row }) => (
          <div className="w-full h-full px-2 flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(row.original.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      });
    }

    return cols;
  }, [t, tShifts, canManage, onStatusChange, onDelete]);

  const headerTabs = (
    <div className="flex items-center justify-between w-full py-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        {t('allScheduledShifts')}
      </span>
      <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filterAll')}</SelectItem>
          <SelectItem value="upcoming">{t('filterUpcoming')}</SelectItem>
          <SelectItem value="past">{t('filterPast')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="h-full min-h-[400px] flex flex-col">
      <DataGridSurface
        data={rows}
        columns={columns}
        getRowId={r => r.id}
        onRowClick={row => onShiftClick?.(row.rawShift)}
        renderTabs={headerTabs}
        emptyMessage={t('noShiftsFound')}
      />
    </div>
  );
}
