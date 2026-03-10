"use client";
import { useMemo, useState, DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { ScheduledShift, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { cn } from '@/components/time-tracker/lib/utils';

interface ScheduleMatrixViewProps {
  shifts: ScheduledShift[];
  workers: { id: string; full_name: string; hourly_rate?: number | null }[];
  weekStart: Date;
  weekCount: 1 | 2;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onWeekCountChange: (count: 1 | 2) => void;
  onShiftMove?: (shiftId: string, newUserId: string, newDate: string) => Promise<void>;
  onShiftClick?: (shift: ScheduledShift) => void;
  onAddShift?: (userId: string, date: string) => void;
  canManage?: boolean;
}

function calculateShiftHours(shiftStart: string, shiftEnd: string): number {
  const [startH, startM] = shiftStart.split(':').map(Number);
  const [endH, endM] = shiftEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return (endMinutes - startMinutes) / 60;
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

export function ScheduleMatrixView({
  shifts,
  workers,
  weekStart,
  weekCount,
  onPrevWeek,
  onNextWeek,
  onWeekCountChange,
  onShiftMove,
  onShiftClick,
  onAddShift,
  canManage,
}: ScheduleMatrixViewProps) {
  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ userId: string; date: string } | null>(null);
  
  const daysCount = weekCount * 7;
  
  const dates = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      result.push(date);
    }
    return result;
  }, [weekStart, daysCount]);

  const weekEndDate = dates[dates.length - 1];

  // Create a map of shifts by worker and date
  const shiftMap = useMemo(() => {
    const map: Record<string, Record<string, ScheduledShift[]>> = {};
    
    workers.forEach(worker => {
      map[worker.id] = {};
    });

    shifts.forEach(shift => {
      if (!map[shift.user_id]) {
        map[shift.user_id] = {};
      }
      if (!map[shift.user_id][shift.shift_date]) {
        map[shift.user_id][shift.shift_date] = [];
      }
      map[shift.user_id][shift.shift_date].push(shift);
    });

    return map;
  }, [shifts, workers]);

  // Create a map of worker hourly rates
  const workerRates = useMemo(() => {
    const rates: Record<string, number> = {};
    workers.forEach(worker => {
      rates[worker.id] = worker.hourly_rate || 0;
    });
    return rates;
  }, [workers]);

  // Calculate daily totals (hours and cost)
  const dailyTotals = useMemo(() => {
    const totals: Record<string, { hours: number; cost: number }> = {};
    
    dates.forEach(date => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      let totalHours = 0;
      let totalCost = 0;
      
      shifts.forEach(shift => {
        if (shift.shift_date === dateStr) {
          const hours = calculateShiftHours(shift.shift_start, shift.shift_end);
          totalHours += hours;
          totalCost += hours * (workerRates[shift.user_id] || 0);
        }
      });
      
      totals[dateStr] = { hours: totalHours, cost: totalCost };
    });
    
    return totals;
  }, [dates, shifts, workerRates]);

  const formatDateHeader = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const num = date.getDate();
    return { day, num };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, shiftId: string) => {
    e.dataTransfer.setData('text/plain', shiftId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedShiftId(shiftId);
  };

  const handleDragEnd = () => {
    setDraggedShiftId(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: DragEvent<HTMLTableCellElement>, userId: string, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ userId, date: dateStr });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: DragEvent<HTMLTableCellElement>, userId: string, dateStr: string) => {
    e.preventDefault();
    const shiftId = e.dataTransfer.getData('text/plain');
    
    if (shiftId && onShiftMove) {
      await onShiftMove(shiftId, userId, dateStr);
    }
    
    setDraggedShiftId(null);
    setDropTarget(null);
  };

  const isDropTarget = (userId: string, dateStr: string) => {
    return dropTarget?.userId === userId && dropTarget?.date === dateStr;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <CardTitle>Schedule Matrix</CardTitle>
            {canManage && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Drag shifts to reschedule
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={weekCount === 1 ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none h-8"
                onClick={() => onWeekCountChange(1)}
              >
                1 Week
              </Button>
              <Button
                variant={weekCount === 2 ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none h-8"
                onClick={() => onWeekCountChange(2)}
              >
                2 Weeks
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium px-2 min-w-[180px] text-center">
                {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="border bg-muted/50 p-2 text-left font-medium text-sm sticky left-0 bg-card z-10 min-w-[150px]">
                  Employee
                </th>
                {dates.map((date, i) => {
                  const { day, num } = formatDateHeader(date);
                  return (
                    <th
                      key={i}
                      className={cn(
                        "border p-2 text-center font-medium text-xs min-w-[100px]",
                        isToday(date) && "bg-primary/10",
                        isWeekend(date) && !isToday(date) && "bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "font-medium",
                        isToday(date) && "text-primary"
                      )}>
                        {day}
                      </div>
                      <div className={cn(
                        "text-lg",
                        isToday(date) ? "text-primary font-bold" : "text-muted-foreground"
                      )}>
                        {num}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr className="bg-muted/30">
                <td className="border p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10">
                  Daily Total
                </td>
                {dates.map((date, i) => {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const dateStr = `${year}-${month}-${day}`;
                  const totals = dailyTotals[dateStr] || { hours: 0, cost: 0 };
                  
                  return (
                    <td
                      key={i}
                      className={cn(
                        "border p-2 text-center text-xs",
                        isToday(date) && "bg-primary/10"
                      )}
                    >
                      <span className="font-medium">{totals.hours.toFixed(1)}</span>
                      <span className="text-muted-foreground"> hours</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="font-medium">{totals.cost.toFixed(0)}</span>
                      <span className="text-muted-foreground"> €</span>
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 ? (
                <tr>
                  <td colSpan={daysCount + 1} className="border p-8 text-center text-muted-foreground">
                    No workers found
                  </td>
                </tr>
              ) : (
                workers.map(worker => (
                  <tr key={worker.id}>
                    <td className="border p-2 font-medium text-sm sticky left-0 bg-card z-10">
                      {worker.full_name}
                    </td>
                    {dates.map((date, i) => {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${day}`;
                      const dayShifts = shiftMap[worker.id]?.[dateStr] || [];
                      const isTarget = isDropTarget(worker.id, dateStr);
                      
                      return (
                        <td
                          key={i}
                          className={cn(
                            "border p-1 align-top min-h-[60px] transition-colors",
                            isToday(date) && "bg-primary/5",
                            isWeekend(date) && !isToday(date) && "bg-muted/20",
                            isTarget && "bg-primary/20 ring-2 ring-primary ring-inset",
                            canManage && "cursor-pointer"
                          )}
                          onDragOver={canManage ? (e) => handleDragOver(e, worker.id, dateStr) : undefined}
                          onDragLeave={canManage ? handleDragLeave : undefined}
                          onDrop={canManage ? (e) => handleDrop(e, worker.id, dateStr) : undefined}
                        >
                          <div className="space-y-1 min-h-[40px] relative group/cell">
                            {dayShifts.map(shift => {
                              const projectColor = shift.project?.color ? getNotionColor(shift.project.color) : null;
                              const isDragging = draggedShiftId === shift.id;
                              
                              return (
                                <div
                                  key={shift.id}
                                  draggable={canManage}
                                  onDragStart={canManage ? (e) => handleDragStart(e, shift.id) : undefined}
                                  onDragEnd={canManage ? handleDragEnd : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShiftClick?.(shift);
                                  }}
                                  className={cn(
                                    "text-xs p-1.5 rounded group cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
                                    canManage && "cursor-grab active:cursor-grabbing",
                                    isDragging && "opacity-50 scale-95",
                                    !projectColor && "border-2 border-dashed border-muted-foreground/40 bg-muted/50"
                                  )}
                                  style={projectColor ? {
                                    backgroundColor: projectColor.value,
                                    color: '#fff'
                                  } : undefined}
                                >
                                  <div className="flex items-start gap-1">
                                    {canManage && (
                                      <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-50 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium">
                                        {formatTime(shift.shift_start)} - {formatTime(shift.shift_end)}
                                      </div>
                                      {shift.project && (
                                        <div className="text-[10px] opacity-90 truncate">
                                          {shift.project.name}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {canManage && onAddShift && dayShifts.length === 0 && (
                              <button
                                onClick={() => onAddShift(worker.id, dateStr)}
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              >
                                <Plus className="h-5 w-5 text-muted-foreground hover:text-primary" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
