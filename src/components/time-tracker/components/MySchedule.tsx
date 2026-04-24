// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, Briefcase, Loader2, CheckSquare, Play, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Button } from '@/components/time-tracker/components/ui/button';
import { ScrollArea } from '@/components/time-tracker/components/ui/scroll-area';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { format, parseISO, isToday, addDays, subDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { toast } from 'sonner';

interface ShiftCardProps {
  shift: any;
  profile: any;
  isNextShift: boolean;
  activeEntry: any;
  onClockIn: (shiftId: string) => void;
  isClockingIn: boolean;
}

function ShiftCard({ shift, profile, isNextShift, activeEntry, onClockIn, isClockingIn }: ShiftCardProps) {
  const { shiftTasks, loading: tasksLoading } = useShiftTasks(shift.id);
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const pendingTasks = shiftTasks.filter(st => st.status !== 'completed');
  const completedTasks = shiftTasks.filter(st => st.status === 'completed');

  const canClockIn = shift && 
    isToday(parseISO(shift.shift_date)) && 
    !shift.clock_entry_id && 
    !activeEntry &&
    shift.status !== 'Completed';

  const isClockedIn = activeEntry && shift?.clock_entry_id === activeEntry.id;
  const shiftDate = parseISO(shift.shift_date);
  const isPast = isBefore(startOfDay(shiftDate), startOfDay(new Date()));

  return (
    <Card className={`${isClockedIn ? 'ring-2 ring-green-500' : ''} ${isNextShift ? 'border-primary' : ''} ${isPast ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            {/* Date */}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {isToday(shiftDate) 
                  ? 'Today' 
                  : format(shiftDate, 'EEE, d MMM')}
              </span>
              {isNextShift && !isToday(shiftDate) && (
                <Badge variant="outline" className="text-xs">Next</Badge>
              )}
              {isClockedIn && (
                <Badge className="bg-primary text-primary-foreground animate-pulse text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>

            {/* Time */}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatTime(shift.shift_start)} - {formatTime(shift.shift_end)}
              </span>
            </div>

            {/* Project/Location */}
            {shift.project && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{shift.project.address || shift.project.name}</span>
              </div>
            )}

            {/* Worker Name */}
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{shift.profile?.full_name || profile?.full_name || 'Unknown'}</span>
            </div>

            {/* Role */}
            {shift.role && (
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{shift.role}</span>
              </div>
            )}
          </div>

          {/* Clock In Button */}
          {canClockIn && (
            <Button
              size="sm"
              onClick={() => onClockIn(shift.id)}
              disabled={isClockingIn}
              className="flex items-center gap-1 shrink-0"
            >
              {isClockingIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Clock In
            </Button>
          )}
        </div>

        {/* Tasks Section */}
        {shiftTasks.length > 0 && (
          <div className="border-t mt-3 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Tasks ({completedTasks.length}/{shiftTasks.length})
              </span>
            </div>
            
            {tasksLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="space-y-1">
                {pendingTasks.slice(0, 2).map((st) => (
                  <div key={st.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-sm truncate">{st.task?.title}</span>
                  </div>
                ))}
                {pendingTasks.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{pendingTasks.length - 2} more
                  </Badge>
                )}
                {pendingTasks.length === 0 && completedTasks.length > 0 && (
                  <p className="text-sm text-primary font-medium">
                    All tasks completed!
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MySchedule() {
  const { user, profile } = useAuth();
  const { shifts, loading } = useScheduledShifts();
  const { activeEntry, clockIn } = useClockEntries();
  const { location, requestLocation } = useGeolocation();
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [clockingShiftId, setClockingShiftId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextShiftRef = useRef<HTMLDivElement>(null);

  // Date range: 1 week behind to 2 weeks ahead
  const today = startOfDay(new Date());
  const rangeStart = subDays(today, 7);
  const rangeEnd = addDays(today, 14);

  // Filter to user's shifts within the date range
  const filteredShifts = useMemo(() => {
    return shifts
      .filter(s => s.user_id === user?.id)
      .filter(s => {
        const shiftDate = startOfDay(parseISO(s.shift_date));
        return !isBefore(shiftDate, rangeStart) && !isAfter(shiftDate, rangeEnd);
      })
      .sort((a, b) => a.shift_date.localeCompare(b.shift_date));
  }, [shifts, user?.id, rangeStart, rangeEnd]);

  // Find the next upcoming shift (today or future)
  const nextShiftIndex = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const idx = filteredShifts.findIndex(s => s.shift_date >= todayStr);
    return idx >= 0 ? idx : filteredShifts.length - 1;
  }, [filteredShifts, today]);

  const nextShift = filteredShifts[nextShiftIndex];

  // Scroll to next shift on mount
  useEffect(() => {
    if (nextShiftRef.current && !loading) {
      setTimeout(() => {
        nextShiftRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }, 100);
    }
  }, [loading, nextShiftIndex]);

  const handleClockIn = async (shiftId: string) => {
    const shift = filteredShifts.find(s => s.id === shiftId);
    if (!shift) return;
    
    setIsClockingIn(true);
    setClockingShiftId(shiftId);
    try {
      await requestLocation();
      const { error } = await clockIn(location, shift.id);
      
      if (error) {
        toast.error('Failed to clock in');
      } else {
        toast.success('Clocked in successfully');
      }
    } catch (err) {
      toast.error('Failed to clock in');
    } finally {
      setIsClockingIn(false);
      setClockingShiftId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Schedule
          </CardTitle>
          {activeEntry && (
            <Badge className="bg-primary text-primary-foreground animate-pulse">
              <Clock className="h-3 w-3 mr-1" />
              Clocked In
            </Badge>
          )}
        </div>
        <CardDescription>
          {filteredShifts.length > 0 
            ? `${filteredShifts.length} shifts • 1 week ago to 2 weeks ahead`
            : 'No shifts scheduled'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {filteredShifts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 px-4">
            No shifts scheduled in this period.
          </p>
        ) : (
          <ScrollArea className="h-[400px]" ref={scrollRef}>
            <div className="space-y-3 p-4">
              {filteredShifts.map((shift, index) => (
                <div 
                  key={shift.id} 
                  ref={index === nextShiftIndex ? nextShiftRef : undefined}
                >
                  <ShiftCard
                    shift={shift}
                    profile={profile}
                    isNextShift={shift.id === nextShift?.id}
                    activeEntry={activeEntry}
                    onClockIn={handleClockIn}
                    isClockingIn={isClockingIn && clockingShiftId === shift.id}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
