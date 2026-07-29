// @ts-nocheck
"use client";
// @ts-nocheck — Legacy component, progressive migration to camelCase
import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, Briefcase, Loader2, CheckSquare, Play, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useGeolocation, validateGeofence } from '@/components/time-tracker/hooks/useGeolocation';
import { GeofenceWarningDialog } from './GeofenceWarningDialog';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { format, parseISO, isToday, addDays, subDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ShiftCardProps {
  shift: any;
  profile: any;
  isNextShift: boolean;
  activeEntry: any;
  onClick: () => void;
}

function ShiftCard({ shift, isNextShift, activeEntry, onClick }: ShiftCardProps) {
  const { t } = useTranslation();
  const { shiftTasks, loading: tasksLoading } = useShiftTasks(shift.id);
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const pendingTasks = shiftTasks.filter(st => st.status !== 'completed');
  const completedTasks = shiftTasks.filter(st => st.status === 'completed');

  const isClockedIn = activeEntry && shift?.clock_entry_id === activeEntry.id;
  const shiftDate = parseISO(shift.shiftDate);
  const isPast = isBefore(startOfDay(shiftDate), startOfDay(new Date()));

  return (
    <Card 
      className={`rounded-none border-x-0 border-t-0 border-b md:rounded-xl md:border-x md:border-t cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors ${isClockedIn ? 'ring-2 ring-[var(--brand-color,#d35400)]' : ''} ${isNextShift ? 'border-primary' : ''} ${isPast ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            {/* Date */}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {isToday(shiftDate) 
                  ? t('schedule.today') 
                  : format(shiftDate, 'EEE, d MMM')}
              </span>
              {isNextShift && !isToday(shiftDate) && (
                <Badge variant="outline" className="text-xs">{t('schedule.next')}</Badge>
              )}
              {isClockedIn && (
                <Badge className="bg-primary text-primary-foreground animate-pulse text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {t('schedule.active')}
                </Badge>
              )}
            </div>

            {/* Title */}
            <div className="flex items-center gap-3 text-lg font-bold mt-1">
              {shift.status === 'leave' ? '🌴 ' : ''}
              <span>{shift.shiftName || shift.projectName || (shift.project?.name || '').replace(/^\[ERP\]\s*/i, '') || (shift.status === 'leave' ? 'Leave' : 'Shift')}</span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-3 text-sm mt-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatTime(shift.shift_start)} - {formatTime(shift.shift_end)}
              </span>
            </div>

            {/* Location */}
            {shift.project?.address && (
              <div className="flex items-start gap-3 text-sm mt-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="leading-tight">{shift.project.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tasks Section */}
        {shiftTasks.length > 0 && (
          <div className="border-t mt-3 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t('schedule.tasks')} ({completedTasks.length}/{shiftTasks.length})
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
                    +{pendingTasks.length - 2} {t('schedule.more')}
                  </Badge>
                )}
                {pendingTasks.length === 0 && completedTasks.length > 0 && (
                  <p className="text-sm text-primary font-medium">
                    {t('schedule.allTasksCompleted')}
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isManager } = useUserRoles();
  const { shifts, loading } = useScheduledShifts();
  const { activeEntry, clockIn, clockOut } = useClockEntries();
  const { location, requestLocation } = useGeolocation();
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [showGeofenceWarning, setShowGeofenceWarning] = useState<{distance: number, site: string, location: any, shiftId: string} | null>(null);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextShiftRef = useRef<HTMLDivElement>(null);

  // Date range: 1 week behind to 2 weeks ahead
  const today = startOfDay(new Date());
  const rangeStartStr = format(subDays(today, 7), 'yyyy-MM-dd');
  const rangeEndStr = format(addDays(today, 14), 'yyyy-MM-dd');

  // Filter to user's shifts within the date range
  const filteredShifts = useMemo(() => {
    return shifts
      .filter(s => s.userId === user?.id)
      .filter(s => {
        return s.shiftDate >= rangeStartStr && s.shiftDate <= rangeEndStr;
      })
      .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
  }, [shifts, user?.id, rangeStartStr, rangeEndStr]);

  // Find the next upcoming shift (today or future)
  const nextShiftIndex = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const idx = filteredShifts.findIndex(s => s.shiftDate >= todayStr);
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

  // Live timer effect using persisted activeEntry
  useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(activeEntry.clock_in_time).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setElapsedTime(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEntry]);

  const handleClockIn = async (shiftId: string, overrideShiftWithFallback = false) => {
    setIsClockingIn(true);
    try {
      const location = showGeofenceWarning?.location || await requestLocation();
      const shift = shifts.find(s => s.id === shiftId);

      // Validate Geofence FIRST
      if (!overrideShiftWithFallback && shift?.project?.latitude && shift?.project?.longitude && location) {
        const fence = validateGeofence(
          { latitude: location.latitude, longitude: location.longitude, accuracy: 0 },
          shift.project.latitude,
          shift.project.longitude,
          200
        );
        if (!fence.withinFence) {
          setShowGeofenceWarning({
            distance: fence.distanceMeters,
            site: shift.project.name || 'site',
            location,
            shiftId
          });
          setIsClockingIn(false);
          return;
        }
      }

      const clockInData: Record<string, any> = {};
      if (location) {
        clockInData.clockInLatitude = location.latitude;
        clockInData.clockInLongitude = location.longitude;
      }
      if (overrideShiftWithFallback) {
        clockInData.requiresApproval = true;
        clockInData.approvalStatus = 'pending';
      } else {
        clockInData.shiftId = shiftId;
      }

      const { error } = await clockIn(clockInData);
      
      if (error) {
        toast.error('Failed to clock in');
      } else {
        toast.success(overrideShiftWithFallback ? 'Clocked in without shift (pending approval)' : 'Clocked in successfully');
        setShowGeofenceWarning(null);
      }
    } catch (err) {
      toast.error('Failed to clock in');
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    setIsClockingOut(true);
    try {
      await requestLocation();
      const { error } = await clockOut({
        clockOutLatitude: location?.latitude,
        clockOutLongitude: location?.longitude,
      });
      
      if (error) {
        toast.error('Failed to clock out');
      } else {
        toast.success('Clocked out successfully');
        setSelectedShift(null); // Close dialog on clock out
      }
    } catch (err) {
      toast.error('Failed to clock out');
    } finally {
      setIsClockingOut(false);
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
            {isManager 
              ? 'Workforce/Team Schedule' 
              : t('schedule.mySchedule')}
          </CardTitle>
          {activeEntry && (
            <Badge className="bg-primary text-primary-foreground animate-pulse">
              <Clock className="h-3 w-3 mr-1" />
              {t('clock.clockedIn', 'Clocked In')}
            </Badge>
          )}
        </div>
        <CardDescription>
          {filteredShifts.length > 0 
            ? `${filteredShifts.length} shifts • 1 week ago to 2 weeks ahead`
            : t('schedule.noShiftsScheduled')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {filteredShifts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 px-4">
            {t('schedule.noShiftsScheduledPeriod')}
          </p>
        ) : (
          <ScrollArea className="h-[500px]" ref={scrollRef}>
            <div className="space-y-0 md:space-y-3 p-0 md:p-4">
              {filteredShifts.map((shift, index) => (
                <div 
                  key={shift.id} 
                  ref={index === nextShiftIndex ? nextShiftRef : undefined}
                >
                  <ShiftCard
                    shift={shift}
                    profile={user}
                    isNextShift={shift.id === nextShift?.id}
                    activeEntry={activeEntry}
                    onClick={() => setSelectedShift(shift)}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Shift Detail Dialog (WF-6) */}
      <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
          {selectedShift && (
            <>
              <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  {isToday(parseISO(selectedShift.shiftDate)) 
                    ? t('schedule.today') 
                    : format(parseISO(selectedShift.shiftDate), 'EEE, d MMM yyyy')}
                </DialogTitle>
                <div className="flex flex-col gap-2 mt-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedShift.shift_start} - {selectedShift.shift_end}</span>
                  </div>
                  {selectedShift.project && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{(selectedShift.project.address || selectedShift.project.name || '').replace(/^\[ERP\]\s*/i, '')}</span>
                    </div>
                  )}
                </div>
              </DialogHeader>
              
              <div className="p-6 bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center">
                {activeEntry && selectedShift.clock_entry_id === activeEntry.id ? (
                  <>
                    <div className="text-4xl font-mono font-bold text-[var(--brand-color,#d35400)] mb-4 tracking-wider">
                      {elapsedTime}
                    </div>
                    <Button 
                      className="w-full h-16 text-lg font-bold bg-[var(--brand-color,#d35400)] hover:brightness-110 text-white shadow-md transition-all active:scale-95"
                      onClick={handleClockOut}
                      disabled={isClockingOut}
                    >
                      {isClockingOut ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Play className="w-6 h-6 mr-2 fill-current rotate-90" />}
                      {t('clock.clockOut', 'CLOCK OUT')}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-mono font-bold text-neutral-400 mb-4 tracking-wider">
                      00:00:00
                    </div>
                    <Button 
                      className="w-full h-16 text-lg font-bold bg-[var(--brand-color,#d35400)] hover:brightness-110 text-white shadow-md transition-all active:scale-95"
                      onClick={() => handleClockIn(selectedShift.id)}
                      disabled={
                        isClockingIn || 
                        selectedShift.status === 'Completed' ||
                        !!selectedShift.clock_entry_id ||
                        !!activeEntry
                      }
                    >
                      {isClockingIn ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Play className="w-6 h-6 mr-2 fill-current" />}
                      {t('clock.clockIn', 'CLOCK IN')}
                    </Button>
                    {(selectedShift.clock_entry_id || selectedShift.status === 'Completed') && (
                      <p className="text-xs text-muted-foreground mt-3 font-medium uppercase tracking-wider">
                        Shift completed
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <GeofenceWarningDialog
        open={!!showGeofenceWarning}
        distanceMeters={showGeofenceWarning?.distance || 0}
        siteName={showGeofenceWarning?.site || ''}
        onCancel={() => setShowGeofenceWarning(null)}
        onClockWithoutShift={() => {
          if (showGeofenceWarning?.shiftId) {
            handleClockIn(showGeofenceWarning.shiftId, true);
          }
        }}
      />
    </Card>
  );
}
