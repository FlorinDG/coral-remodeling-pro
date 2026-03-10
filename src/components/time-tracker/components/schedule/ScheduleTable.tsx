"use client";
import { useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/time-tracker/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import { ScheduledShift, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { cn } from '@/components/time-tracker/lib/utils';

interface ScheduleTableProps {
  shifts: ScheduledShift[];
  onDelete?: (shiftId: string) => void;
  onStatusChange?: (shiftId: string, status: string) => void;
  onShiftClick?: (shift: ScheduledShift) => void;
  canManage?: boolean;
}

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  });
}

const STATUS_OPTIONS = ['Scheduled', 'Active', 'In Progress', 'Completed', 'Cancelled'];

function getStatusColor(status: string) {
  switch (status) {
    case 'Scheduled': return 'bg-muted text-muted-foreground';
    case 'Active': return 'bg-primary/20 text-primary';
    case 'In Progress': return 'bg-secondary/20 text-secondary';
    case 'Completed': return 'bg-accent/20 text-accent-foreground';
    case 'Cancelled': return 'bg-destructive/20 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function ScheduleTable({ shifts, onDelete, onStatusChange, onShiftClick, canManage }: ScheduleTableProps) {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  
  const today = new Date().toISOString().split('T')[0];
  
  const filteredShifts = shifts.filter(shift => {
    if (filter === 'upcoming') return shift.shift_date >= today;
    if (filter === 'past') return shift.shift_date < today;
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
                  
                  return (
                    <TableRow 
                      key={shift.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onShiftClick?.(shift)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDate(shift.shift_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(shift.shift_start)} - {formatTime(shift.shift_end)}
                      </TableCell>
                      <TableCell>
                        {shift.profile?.full_name || 'Unknown'}
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
                        {canManage && onStatusChange ? (
                          <Select 
                            value={shift.status} 
                            onValueChange={(v) => onStatusChange(shift.id, v)}
                          >
                            <SelectTrigger className={cn("w-28 h-7 text-xs", getStatusColor(shift.status))}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(status => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn("px-2 py-0.5 rounded-full text-xs", getStatusColor(shift.status))}>
                            {shift.status}
                          </span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete?.(shift.id)}
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
