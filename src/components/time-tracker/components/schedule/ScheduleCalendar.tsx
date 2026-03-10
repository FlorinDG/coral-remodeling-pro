"use client";
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Flag } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { ScheduledShift, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { cn } from '@/components/time-tracker/lib/utils';
import { isBelgianHoliday, getHolidayMap, formatDateKey } from '@/components/time-tracker/lib/belgianHolidays';

interface ScheduleCalendarProps {
  shifts: ScheduledShift[];
  onShiftClick?: (shift: ScheduledShift) => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6]; // Default to blue
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
    default: return 'bg-muted text-muted-foreground';
  }
}

// Mobile card view for shifts
function ShiftCard({ shift, onClick }: { shift: ScheduledShift; onClick?: () => void }) {
  const projectColor = shift.project?.color ? getNotionColor(shift.project.color) : getNotionColor('blue');
  
  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
      style={{ 
        borderLeftWidth: 4, 
        borderLeftColor: projectColor.value,
        backgroundColor: `${projectColor.bg}40`
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {shift.project?.name || 'No Project'}
          </p>
          <p className="font-semibold text-sm truncate">
            {shift.profile?.full_name || 'Unassigned'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {shift.project?.address || 'No location'}
          </p>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', getStatusColor(shift.status))}>
          {shift.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTime(shift.shift_start)} - {formatTime(shift.shift_end)}</span>
        {shift.role && <span className="text-primary">{shift.role}</span>}
      </div>
    </div>
  );
}

// Mobile week view with stacked cards per day
function MobileWeekView({ shifts, weekStart, onShiftClick }: { 
  shifts: ScheduledShift[]; 
  weekStart: Date;
  onShiftClick?: (shift: ScheduledShift) => void;
}) {
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const weekDays = useMemo(() => {
    const days: { date: Date; dateStr: string; shifts: ScheduledShift[]; holiday: ReturnType<typeof isBelgianHoliday> }[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatLocalDate(date);
      days.push({
        date,
        dateStr,
        shifts: shifts.filter(s => s.shift_date === dateStr),
        holiday: isBelgianHoliday(date),
      });
    }
    
    return days;
  }, [shifts, weekStart]);

  const today = formatLocalDate(new Date());

  return (
    <div className="space-y-4">
      {weekDays.map(({ date, dateStr, shifts: dayShifts, holiday }) => (
        <div key={dateStr} className={cn(
          "rounded-lg border p-3",
          dateStr === today && "ring-2 ring-primary",
          holiday && "bg-destructive/5 border-destructive/20"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {FULL_DAY_NAMES[(date.getDay() + 6) % 7]}
              </span>
              {holiday && (
                <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                  <Flag className="h-3 w-3" />
                  {holiday.name}
                </span>
              )}
            </div>
            <span className={cn(
              "text-sm px-2 py-0.5 rounded-full",
              dateStr === today ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}>
              {date.getDate()}
            </span>
          </div>
          
          {dayShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              {holiday ? 'Public holiday' : 'No shifts'}
            </p>
          ) : (
            <div className="space-y-2">
              {dayShifts.map(shift => (
                <ShiftCard 
                  key={shift.id} 
                  shift={shift} 
                  onClick={() => onShiftClick?.(shift)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Desktop calendar grid view
function DesktopCalendarView({ shifts, currentMonth, onShiftClick }: {
  shifts: ScheduledShift[];
  currentMonth: Date;
  onShiftClick?: (shift: ScheduledShift) => void;
}) {
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { calendarDays, holidayMap } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    // Adjust to start on Monday
    const dayOfWeek = firstDay.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + diff);
    
    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; shifts: ScheduledShift[] }[] = [];
    
    const current = new Date(startDate);
    while (current <= lastDay || current.getDay() !== 1) {
      const dateStr = formatLocalDate(current);
      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth: current.getMonth() === month,
        shifts: shifts.filter(s => s.shift_date === dateStr),
      });
      current.setDate(current.getDate() + 1);
      if (days.length >= 42) break; // Max 6 weeks
    }
    
    // Get holiday map for current year and adjacent years
    const hMap = new Map([
      ...getHolidayMap(year - 1),
      ...getHolidayMap(year),
      ...getHolidayMap(year + 1),
    ]);
    
    return { calendarDays: days, holidayMap: hMap };
  }, [shifts, currentMonth]);

  const today = formatLocalDate(new Date());

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {/* Header */}
      {DAY_NAMES.map(day => (
        <div key={day} className="bg-muted p-2 text-center text-sm font-medium">
          {day}
        </div>
      ))}
      
      {/* Days */}
      {calendarDays.map(({ date, dateStr, isCurrentMonth, shifts: dayShifts }) => {
        const holiday = holidayMap.get(formatDateKey(date));
        
        return (
          <div 
            key={dateStr}
            className={cn(
              "bg-background min-h-24 p-1",
              !isCurrentMonth && "opacity-40",
              holiday && "bg-destructive/5"
            )}
          >
            <div className="flex items-center gap-1">
              <div className={cn(
                "text-sm w-6 h-6 flex items-center justify-center rounded-full",
                dateStr === today && "bg-primary text-primary-foreground"
              )}>
                {date.getDate()}
              </div>
              {holiday && (
                <Flag className="h-3 w-3 text-destructive" />
              )}
            </div>
            {holiday && (
              <div className="text-[10px] text-destructive truncate px-0.5">
                {holiday.name}
              </div>
            )}
            <div className="space-y-0.5 mt-0.5">
              {dayShifts.slice(0, holiday ? 2 : 3).map(shift => {
                const projectColor = shift.project?.color ? getNotionColor(shift.project.color) : getNotionColor('blue');
                return (
                  <div
                    key={shift.id}
                    onClick={() => onShiftClick?.(shift)}
                    className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                    style={{ 
                      backgroundColor: projectColor.bg,
                      color: projectColor.value
                    }}
                  >
                    {formatTime(shift.shift_start)}
                    {shift.profile?.full_name && (
                      <span className="font-semibold"> · {shift.profile.full_name}</span>
                    )}
                    {shift.project?.name ? (
                      <span className="text-muted-foreground"> · {shift.project.name}</span>
                    ) : (
                      ' Shift'
                    )}
                  </div>
                );
              })}
              {dayShifts.length > (holiday ? 2 : 3) && (
                <div className="text-xs text-muted-foreground px-1">
                  +{dayShifts.length - (holiday ? 2 : 3)} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScheduleCalendar({ shifts, onShiftClick }: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Get the start of the current week (Monday)
  const weekStart = useMemo(() => {
    const date = new Date(currentDate);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to Monday
    date.setDate(date.getDate() + diff);
    return date;
  }, [currentDate]);

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${
    new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center border rounded-md">
              <Button 
                variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('week')}
                className="rounded-r-none"
              >
                Week
              </Button>
              <Button 
                variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('month')}
                className="rounded-l-none"
              >
                Month
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            {viewMode === 'week' ? weekRange : monthYear}
          </span>
          <Button variant="ghost" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Mobile: Week view with stacked cards */}
        <div className="block md:hidden">
          <MobileWeekView 
            shifts={shifts} 
            weekStart={weekStart} 
            onShiftClick={onShiftClick}
          />
        </div>
        
        {/* Desktop: Calendar grid or week grid */}
        <div className="hidden md:block">
          {viewMode === 'month' ? (
            <DesktopCalendarView 
              shifts={shifts} 
              currentMonth={currentDate}
              onShiftClick={onShiftClick}
            />
          ) : (
            <MobileWeekView 
              shifts={shifts} 
              weekStart={weekStart} 
              onShiftClick={onShiftClick}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
