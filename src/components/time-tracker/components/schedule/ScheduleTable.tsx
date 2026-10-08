"use client";
import { useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTime } from '@/lib/format/date';
import { ScheduledShift, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { cn } from '@/lib/utils';
import { shiftStatus, isWritableShiftStatus, SHIFT_STATUS_OPTIONS } from '@/lib/kernel/shift-status';
import { shiftMoment, zonedParts } from '@/lib/kernel/shift-time';
import { SHIFT_STATUS_LABEL, SHIFT_STATUS_PILL } from './shift-status-ui';

interface ScheduleTableProps {
  shifts: ScheduledShift[];
  onDelete?: (shiftId: string) => void;
  onStatusChange?: (shiftId: string, status: string) => void;
  onShiftClick?: (shift: ScheduledShift) => void;
  canManage?: boolean;
  /** Shifts planned on a day their worker is off (kernel/absence leaveConflicts). */
  conflictIds?: Set<string>;
}

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

/** 'YYYY-MM-DD' → 'do 8 okt.' — built from parts at local noon (no UTC parse of a date string). */
function formatDate(dateStr: string) {
  return shiftMoment(dateStr, '12:00').toLocaleDateString('nl-BE', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ScheduleTable({ shifts, onDelete, onStatusChange, onShiftClick, canManage, conflictIds }: ScheduleTableProps) {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  
  const today = zonedParts(new Date()).date;   // the business day — never toISOString() (UTC)
  
  const filteredShifts = shifts.filter(shift => {
    const d = shift.shiftDate || '';
    if (filter === 'upcoming') return d >= today;
    if (filter === 'past') return d < today;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>All Scheduled Shifts</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground py-8">
                    No shifts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredShifts.map(shift => {
                  const projectColor = shift.project?.color ? getNotionColor(shift.project.color) : null;
                  const status = shiftStatus(shift, shift.clockEntries || []);
                  const conflict = conflictIds?.has(shift.id) ?? false;
                  
                  return (
                    <TableRow 
                      key={shift.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onShiftClick?.(shift)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDate(shift.shiftDate || '')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(shift.shiftStart || '00:00')} - {formatTime(shift.shiftEnd || '00:00')}
                      </TableCell>
                      <TableCell>
                        {shift.userName || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {shift.project ? (
                          <span 
                            className="px-2 py-0.5 rounded text-sm"
                            style={projectColor ? {
                              backgroundColor: projectColor.bg,
                              color: projectColor.value
                            } : undefined}
                          >
                            {shift.project.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-32 truncate">
                        {shift.project?.address || '—'}
                      </TableCell>
                      <TableCell>
                        {shift.role || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {canManage && onStatusChange ? (
                          <Select
                            value={status}
                            onValueChange={(v) => { if (isWritableShiftStatus(v)) onStatusChange(shift.id, v); }}
                          >
                            <SelectTrigger className={cn("w-32 h-7 text-xs", SHIFT_STATUS_PILL[status])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SHIFT_STATUS_OPTIONS.map(s => (
                                <SelectItem key={s} value={s} disabled={!isWritableShiftStatus(s)}>
                                  {SHIFT_STATUS_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn("px-2 py-0.5 rounded-full text-xs", SHIFT_STATUS_PILL[status])}>
                            {SHIFT_STATUS_LABEL[status]}
                          </span>
                        )}
                        {conflict && <span className="text-[10px] font-bold text-red-600" title="Deze medewerker heeft verlof op deze dag">⚠ Verlof</span>}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDelete?.(shift.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
