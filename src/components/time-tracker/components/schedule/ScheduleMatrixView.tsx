// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useMemo, useState, DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Plus, Copy, Printer, Clock, Search } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { ScheduledShift, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { cn } from '@/components/time-tracker/lib/utils';
import { toast } from 'sonner';

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
  onCopyWeek?: (sourceWeekStart: Date, targetWeekStart: Date) => Promise<void>;
  canManage?: boolean;
}

function calculateShiftHours(shiftStart: string, shiftEnd: string): number {
  const [startH, startM] = shiftStart.split(':').map(Number);
  const [endH, endM] = shiftEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

function getNotionColor(colorInput: string): string {
  if (colorInput.startsWith('#')) return colorInput;
  const found = NOTION_COLORS.find(c => c.name === colorInput);
  if (found) return found.value;
  return NOTION_COLORS[6]?.value || '#14b8a6';
}

function formatTime(time: string) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  return `${String(h).padStart(2, '0')}:${minutes}`;
}

function getStatusDot(status: string) {
  switch (status) {
    case 'in-progress':
    case 'Active':
      return 'bg-emerald-400';
    case 'completed':
    case 'Completed':
      return 'bg-blue-400';
    case 'Cancelled':
      return 'bg-red-400';
    default:
      return 'bg-neutral-400';
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
  onCopyWeek,
  canManage,
}: ScheduleMatrixViewProps) {
  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ userId: string; date: string } | null>(null);
  const [copying, setCopying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const daysCount = weekCount * 7;

  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    const q = searchQuery.toLowerCase();
    return workers.filter(w => w.full_name?.toLowerCase().includes(q));
  }, [workers, searchQuery]);
  
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
      const uid = shift.userId || shift.user_id || '';
      const sd = shift.shiftDate || shift.shift_date || '';
      if (!map[uid]) {
        map[uid] = {};
      }
      if (!map[uid][sd]) {
        map[uid][sd] = [];
      }
      map[uid][sd].push(shift);
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
    const totals: Record<string, { hours: number; cost: number; headcount: number }> = {};
    
    dates.forEach(date => {
      const dateStr = toDateStr(date);
      let totalHours = 0;
      let totalCost = 0;
      let headcount = 0;
      
      shifts.forEach(shift => {
        const sd = shift.shiftDate || shift.shift_date || '';
        const uid = shift.userId || shift.user_id || '';
        const matchesSearch = filteredWorkers.some(w => w.id === uid);
        if (sd === dateStr && matchesSearch) {
          const ss = shift.shiftStart || shift.shift_start || '08:00';
          const se = shift.shiftEnd || shift.shift_end || '17:00';
          const hours = calculateShiftHours(ss, se);
          totalHours += hours;
          totalCost += hours * (workerRates[uid] || 0);
          headcount++;
        }
      });
      
      totals[dateStr] = { hours: totalHours, cost: totalCost, headcount };
    });
    
    return totals;
  }, [dates, shifts, workerRates, filteredWorkers]);

  // Per-employee weekly hours
  const employeeWeeklyHours = useMemo(() => {
    const result: Record<string, number> = {};
    workers.forEach(w => {
      let total = 0;
      shifts.forEach(shift => {
        const uid = shift.userId || shift.user_id || '';
        if (uid === w.id) {
          const ss = shift.shiftStart || shift.shift_start || '08:00';
          const se = shift.shiftEnd || shift.shift_end || '17:00';
          total += calculateShiftHours(ss, se);
        }
      });
      result[w.id] = total;
    });
    return result;
  }, [workers, shifts]);

  // Grand totals for entire period
  const grandTotals = useMemo(() => {
    let hours = 0;
    let cost = 0;
    Object.values(dailyTotals).forEach(d => {
      hours += d.hours;
      cost += d.cost;
    });
    return { hours, cost };
  }, [dailyTotals]);

  function toDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const formatDateHeader = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const num = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return { day, num, month };
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

  const handleCopyPreviousWeek = async () => {
    if (!onCopyWeek) return;
    setCopying(true);
    try {
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      await onCopyWeek(prevWeekStart, weekStart);
      toast.success('Previous week copied successfully');
    } catch {
      toast.error('Failed to copy previous week');
    } finally {
      setCopying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="print:shadow-none print:border-0">
      <CardHeader className="print:pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Schedule Matrix</CardTitle>
            {canManage && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded print:hidden">
                Drag shifts to reschedule
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative print:hidden">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-input rounded-md outline-none focus:ring-1 focus:ring-primary w-40 text-foreground"
              />
            </div>

            {/* Copy Previous Week */}
            {canManage && onCopyWeek && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs print:hidden"
                onClick={handleCopyPreviousWeek}
                disabled={copying}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copying ? 'Copying...' : 'Copy Prev Week'}
              </Button>
            )}

            {/* Print */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs print:hidden"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print
            </Button>

            {/* Week count toggle */}
            <div className="flex border rounded-md overflow-hidden print:hidden">
              <Button
                variant={weekCount === 1 ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs"
                onClick={() => onWeekCountChange(1)}
              >
                1 Week
              </Button>
              <Button
                variant={weekCount === 2 ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs"
                onClick={() => onWeekCountChange(2)}
              >
                2 Weeks
              </Button>
            </div>

            {/* Week navigation */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 print:hidden" onClick={onPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold px-2 min-w-[200px] text-center">
                {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {weekEndDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 print:hidden" onClick={onNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Period Summary Bar */}
        <div className="flex items-center gap-6 mt-2 px-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{grandTotals.hours.toFixed(1)}</span> hrs total
          </div>
          <div>
            <span className="font-semibold text-foreground">€{grandTotals.cost.toFixed(0)}</span> estimated cost
          </div>
          <div>
            <span className="font-semibold text-foreground">{filteredWorkers.length}</span> employees
          </div>
        </div>
      </CardHeader>
      <CardContent className="print:p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed', minWidth: `${185 + dates.length * 120}px` }}>
            <thead>
              <tr>
                <th 
                  className="border border-border bg-muted/50 p-2 text-left font-semibold text-xs sticky left-0 bg-card z-10"
                  style={{ width: '185px', minWidth: '185px' }}
                >
                  <div className="flex items-center justify-between">
                    <span>Employee</span>
                    <span className="text-[10px] font-normal text-muted-foreground">Hrs</span>
                  </div>
                </th>
                {dates.map((date, i) => {
                  const { day, num, month } = formatDateHeader(date);
                  const today = isToday(date);
                  const weekend = isWeekend(date);
                  return (
                    <th
                      key={i}
                      className={cn(
                        "border border-border p-1.5 text-center font-medium text-xs",
                        today && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                        weekend && !today && "bg-muted/40"
                      )}
                      style={{ width: '120px', minWidth: '120px' }}
                    >
                      <div className={cn(
                        "text-[10px] uppercase tracking-wider",
                        today ? "text-primary font-bold" : weekend ? "text-muted-foreground" : "text-muted-foreground"
                      )}>
                        {day}
                      </div>
                      <div className={cn(
                        "text-base leading-tight",
                        today ? "text-primary font-bold" : "text-foreground"
                      )}>
                        {num}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{month}</div>
                    </th>
                  );
                })}
              </tr>

              {/* Daily totals row */}
              <tr className="bg-muted/30">
                <td 
                  className="border border-border p-1.5 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10"
                  style={{ width: '185px', minWidth: '185px' }}
                >
                  <div className="flex items-center justify-between">
                    <span>Daily Total</span>
                  </div>
                </td>
                {dates.map((date, i) => {
                  const dateStr = toDateStr(date);
                  const totals = dailyTotals[dateStr] || { hours: 0, cost: 0, headcount: 0 };
                  
                  return (
                    <td
                      key={i}
                      className={cn(
                        "border border-border p-1.5 text-center text-[10px]",
                        isToday(date) && "bg-primary/10"
                      )}
                    >
                      <div className="font-semibold text-foreground">{totals.hours.toFixed(1)}h</div>
                      <div className="text-muted-foreground">€{totals.cost.toFixed(0)}</div>
                      <div className="text-muted-foreground">{totals.headcount} 👷</div>
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={daysCount + 1} className="border border-border p-8 text-center text-muted-foreground">
                    <div className="space-y-2">
                      <p className="font-medium">No employees found matching the search criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(worker => {
                  const weeklyHrs = employeeWeeklyHours[worker.id] || 0;
                  return (
                    <tr key={worker.id} className="group/row hover:bg-muted/20 transition-colors">
                      <td 
                        className="border border-border p-2 sticky left-0 bg-card z-10 font-sans"
                        style={{ width: '185px', minWidth: '185px' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm truncate max-w-[120px]">{worker.full_name}</div>
                            {(worker.hourly_rate || 0) > 0 && (
                              <div className="text-[10px] text-muted-foreground">€{worker.hourly_rate}/hr</div>
                            )}
                          </div>
                          <div className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded-md",
                            weeklyHrs > 40 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            weeklyHrs > 0 ? "bg-primary/10 text-primary" :
                            "text-muted-foreground"
                          )}>
                            {weeklyHrs.toFixed(1)}h
                          </div>
                        </div>
                      </td>
                      {dates.map((date, i) => {
                        const dateStr = toDateStr(date);
                        const dayShifts = shiftMap[worker.id]?.[dateStr] || [];
                        const isTarget = isDropTarget(worker.id, dateStr);
                        const weekend = isWeekend(date);
                        
                        return (
                          <td
                            key={i}
                            className={cn(
                              "border border-border p-0.5 align-top transition-colors relative",
                              isToday(date) && "bg-primary/5",
                              weekend && !isToday(date) && "bg-muted/20",
                              isTarget && "bg-primary/20 ring-2 ring-primary ring-inset",
                            )}
                            onDragOver={canManage ? (e) => handleDragOver(e, worker.id, dateStr) : undefined}
                            onDragLeave={canManage ? handleDragLeave : undefined}
                            onDrop={canManage ? (e) => handleDrop(e, worker.id, dateStr) : undefined}
                          >
                            <div className="space-y-0.5 min-h-[52px] p-0.5 relative group/cell">
                              {dayShifts.map(shift => {
                                const projectColor = shift.project?.color ? getNotionColor(shift.project.color) : null;
                                const isDragging = draggedShiftId === shift.id;
                                const ss = shift.shiftStart || shift.shift_start || '08:00';
                                const se = shift.shiftEnd || shift.shift_end || '17:00';
                                const hours = calculateShiftHours(ss, se);
                                const status = shift.status || 'Scheduled';
                                
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
                                      "text-[11px] p-1.5 rounded-md cursor-pointer transition-all border-l-[3px]",
                                      canManage && "cursor-grab active:cursor-grabbing",
                                      isDragging && "opacity-40 scale-95",
                                      "hover:ring-1 hover:ring-primary/40",
                                      projectColor
                                        ? "bg-white/80 dark:bg-neutral-900/80"
                                        : "bg-muted/60 border-l-neutral-400"
                                    )}
                                    style={projectColor ? {
                                      borderLeftColor: projectColor,
                                    } : undefined}
                                  >
                                    <div className="flex items-start gap-1">
                                      {canManage && (
                                        <GripVertical className="h-3 w-3 opacity-0 group-hover/cell:opacity-40 flex-shrink-0 mt-0.5 print:hidden" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                          <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", getStatusDot(status))} />
                                          <span className="font-semibold">
                                            {formatTime(ss)}–{formatTime(se)}
                                          </span>
                                        </div>
                                        {shift.project && (
                                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                            {shift.project.name}
                                          </div>
                                        )}
                                        <div className="text-[10px] text-muted-foreground">{hours.toFixed(1)}h</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Plus button — always visible on hover, even when there are shifts */}
                              {canManage && onAddShift && (
                                <button
                                  onClick={() => onAddShift(worker.id, dateStr)}
                                  className={cn(
                                    "flex items-center justify-center transition-opacity print:hidden rounded",
                                    dayShifts.length === 0
                                      ? "absolute inset-0 opacity-0 group-hover/cell:opacity-100"
                                      : "w-full py-0.5 opacity-0 group-hover/cell:opacity-100 hover:bg-muted/60"
                                  )}
                                >
                                  <Plus className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
