"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, Briefcase, Loader2, CheckSquare, Play, User, Phone, ExternalLink, FileText, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatTime } from '@/lib/format/date';
import { shiftBrief, type ShiftBriefResult } from '@/lib/data/shift-brief';
import { useTimer } from '@/components/time-tracker/hooks/useTimer';

function parseShiftDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

function getShiftTemporalState(shiftDateStr: string, startStr: string, endStr: string, now: Date): 'past' | 'current' | 'upcoming' {
  const start = parseShiftDateTime(shiftDateStr, startStr);
  const end = parseShiftDateTime(shiftDateStr, endStr);
  if (end.getTime() < start.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  const t = now.getTime();
  if (end.getTime() < t) return 'past';
  if (start.getTime() <= t && t <= end.getTime()) return 'current';
  return 'upcoming';
}

interface ShiftCardProps {
  shift: any;
  profile: any;
  isNextShift: boolean;
  activeEntry: any;
  elapsedTime?: string;
  now: Date;
  onClick: () => void;
}

function ShiftCard({ shift, isNextShift, activeEntry, elapsedTime, now, onClick }: ShiftCardProps) {
  const { t } = useTranslation();
  const { shiftTasks, loading: tasksLoading } = useShiftTasks(shift.id);

  const pendingTasks = shiftTasks.filter(st => st.status !== 'completed');
  const completedTasks = shiftTasks.filter(st => st.status === 'completed');

  const isClockedIn = Boolean(activeEntry && activeEntry.shiftId === shift?.id);
  const shiftDate = parseISO(shift.shiftDate);
  const temporalState = getShiftTemporalState(shift.shiftDate, shift.shiftStart, shift.shiftEnd, now);
  const isPast = temporalState === 'past';

  // 3-step fallback chain: Project name -> description (shiftName / notes) -> localized 'shift'
  const projectName = (shift.project?.name || shift.projectName || '').replace(/^\[ERP\]\s*/i, '').trim();
  const description = (shift.shiftName || '').trim() || (shift.notes || '').trim();
  const fallback = t('schedule.shiftFallback');
  const primaryTitle = projectName || description || fallback;

  const address = shift.project?.address?.trim() || shift.projectAddress?.trim();

  return (
    <Card 
      className={`relative overflow-hidden pl-1 rounded-none border-x-0 border-t-0 border-b md:rounded-xl md:border-x md:border-t cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors ${isClockedIn ? 'ring-2 ring-[var(--tawny)]' : ''} ${isNextShift ? 'border-primary' : ''} ${isPast ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      {/* 3-4px vertical rule state bar on the left edge (WH-UI-1 §9.3) */}
      <div 
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          temporalState === 'current'
            ? 'bg-[var(--tawny)]'
            : temporalState === 'upcoming'
              ? 'bg-[var(--persian-green)]'
              : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            {/* Primary line: Project Name */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground leading-snug">
                {shift.status === 'leave' ? '🌴 ' : ''}
                {primaryTitle}
              </h3>
              {isClockedIn && (
                <Badge className="bg-primary text-primary-foreground animate-pulse text-sm font-normal py-0.5 px-2 shrink-0">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  {t('schedule.active')}
                </Badge>
              )}
            </div>

            {/* Second line: Tappable address link to native map */}
            {address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors mt-1"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{address}</span>
              </a>
            )}

            {/* Third line: Time and Date with elapsed time above date (WH-UI-1 §9.4) */}
            <div className="flex items-end justify-between text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {formatTime(shift.shiftStart)} – {formatTime(shift.shiftEnd)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                {isClockedIn && elapsedTime && (
                  <span className="font-mono font-bold text-sm text-[var(--tawny)] tracking-wider">
                    {elapsedTime}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {isToday(shiftDate) 
                      ? t('schedule.today') 
                      : format(shiftDate, 'EEE, d MMM')}
                  </span>
                  {isNextShift && !isToday(shiftDate) && (
                    <Badge variant="outline" className="text-sm font-normal py-0 px-2">{t('schedule.next')}</Badge>
                  )}
                </div>
              </div>
            </div>
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
                    <div className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                    <span className="text-sm truncate">{st.task?.title}</span>
                  </div>
                ))}
                {pendingTasks.length > 2 && (
                  <Badge variant="secondary" className="text-sm">
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
  const [brief, setBrief] = useState<ShiftBriefResult | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const { formattedTime: elapsedTime } = useTimer();
  const [now, setNow] = useState(() => new Date());
  const nextShiftRef = useRef<HTMLDivElement>(null);

  // Minute tick to recompute temporal shift state (WH-UI-1 §9.3)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedShift?.id) {
      setBrief(null);
      return;
    }
    let active = true;
    setBriefLoading(true);
    shiftBrief(selectedShift.id)
      .then((data) => {
        if (active) setBrief(data);
      })
      .catch((err) => {
        console.error('[shiftBrief] Failed to load shift brief:', err);
      })
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedShift?.id]);

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
      <div className="space-y-3 p-4 animate-pulse">
        <div className="h-6 w-40 bg-muted rounded mb-2" />
        <div className="h-24 bg-muted/60 rounded-none md:rounded-xl" />
        <div className="h-24 bg-muted/60 rounded-none md:rounded-xl" />
        <div className="h-24 bg-muted/60 rounded-none md:rounded-xl" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none rounded-none bg-transparent md:border md:shadow-sm md:rounded-xl md:bg-card">
      <CardHeader className="px-4 py-3 md:p-6 md:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isManager 
              ? 'Workforce/Team Schedule' 
              : t('schedule.mySchedule')}
          </CardTitle>
          {activeEntry && (
            <Badge className="bg-primary text-primary-foreground animate-pulse text-sm">
              <Clock className="h-3.5 w-3.5 mr-1" />
              {t('clock.clockedIn', 'Clocked In')}
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm">
          {filteredShifts.length > 0 
            ? `${filteredShifts.length} shifts • 1 week ago to 2 weeks ahead`
            : t('schedule.noShiftsScheduled')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {filteredShifts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 px-4 text-sm">
            {t('schedule.noShiftsScheduledPeriod')}
          </p>
        ) : (
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
                  elapsedTime={elapsedTime}
                  now={now}
                  onClick={() => setSelectedShift(shift)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Shift Detail Dialog / Shift Brief Modal (WH-UI-1 §8.2) */}
      <Dialog open={!!selectedShift} onOpenChange={(open) => { if (!open) setSelectedShift(null); }}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden font-content">
          {selectedShift && (() => {
            const shiftDateObj = parseISO(selectedShift.shiftDate);
            const scheduledDateStr = isToday(shiftDateObj) 
              ? t('schedule.today') 
              : format(shiftDateObj, 'EEE, d MMM yyyy');
            const scheduledTimeStr = `${formatTime(selectedShift.shiftStart)} – ${formatTime(selectedShift.shiftEnd)}`;

            const projectName = (selectedShift.project?.name || selectedShift.projectName || '').replace(/^\[ERP\]\s*/i, '').trim();
            const description = (selectedShift.shiftName || '').trim() || (selectedShift.notes || '').trim();
            const displayTitle = brief?.title || projectName || description || t('schedule.shiftFallback');

            const addressText = brief?.address || selectedShift.project?.address?.trim() || selectedShift.projectAddress?.trim() || null;
            const mapUrl = brief?.mapUrl || (addressText ? `https://maps.google.com/?q=${encodeURIComponent(addressText)}` : null);

            return (
              <>
                <DialogHeader className="p-5 pb-3 border-b border-neutral-100 dark:border-white/10 text-left">
                  <DialogTitle className="text-lg font-semibold text-foreground leading-snug">
                    {displayTitle}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground font-medium">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{scheduledDateStr}</span>
                    <span>·</span>
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{scheduledTimeStr}</span>
                  </div>
                </DialogHeader>

                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                  {/* Address row (maps.google.com/?q=...) */}
                  {addressText && mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 rounded-xl transition-colors border border-neutral-100 dark:border-white/5 text-foreground group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MapPin className="w-5 h-5 text-[var(--persian-green)] shrink-0" />
                        <span className="text-base text-foreground font-medium truncate">{addressText}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
                    </a>
                  )}

                  {/* Phone row (tel:...) */}
                  {brief?.contactPhone && (
                    <a
                      href={`tel:${brief.contactPhone}`}
                      className="flex items-center justify-between p-3.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 rounded-xl transition-colors border border-neutral-100 dark:border-white/5 text-foreground group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Phone className="w-5 h-5 text-[var(--persian-green)] shrink-0" />
                        <span className="text-base text-foreground font-medium truncate">
                          {brief.contactName ? `${brief.contactName} · ` : ''}{brief.contactPhone}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
                    </a>
                  )}

                  {/* Worked duration (only when clock entry exists) */}
                  {brief?.worked && (
                    <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock className="w-5 h-5 text-[var(--persian-green)] shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-muted-foreground">{t('schedule.worked')}</span>
                          <span className="text-base font-semibold text-foreground">
                            {formatTime(brief.worked.in)} – {brief.worked.out ? formatTime(brief.worked.out) : '…'} · {Math.floor(brief.worked.minutes / 60)}h {brief.worked.minutes % 60}m
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Photos */}
                  {brief?.photos && brief.photos.length > 0 && (
                    <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-white/5 space-y-2">
                      <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        {t('schedule.photos')}
                      </span>
                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {brief.photos.map((photo, i) => (
                          <a
                            key={i}
                            href={photo.key}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 dark:border-white/10 hover:opacity-80 transition-opacity"
                          >
                            <img src={photo.key} alt={photo.name} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files */}
                  {brief?.files && brief.files.length > 0 && (
                    <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-100 dark:border-white/5 space-y-2">
                      <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {t('schedule.files')}
                      </span>
                      <div className="space-y-1.5">
                        {brief.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2.5 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 rounded-lg text-sm text-foreground transition-colors group"
                          >
                            <span className="truncate font-medium">{file.name}</span>
                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {briefLoading && !brief && (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Clock Action Surface */}
                <div className="p-4 border-t border-neutral-100 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col items-center">
                  {activeEntry && activeEntry.shiftId === selectedShift.id ? (
                    <>
                      <div className="text-3xl font-mono font-bold text-[var(--tawny)] mb-3 tracking-wider">
                        {elapsedTime}
                      </div>
                      <Button
                        className="w-full h-14 text-base font-bold bg-[var(--tawny)] hover:brightness-110 text-white shadow-md transition-all active:scale-[0.98] rounded-xl"
                        onClick={handleClockOut}
                        disabled={isClockingOut}
                      >
                        {isClockingOut ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2 fill-current rotate-90" />}
                        {t('clock.clockOut', 'CLOCK OUT')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="w-full h-14 text-base font-bold bg-[var(--persian-green)] hover:brightness-110 text-white shadow-md transition-all active:scale-[0.98] rounded-xl"
                        onClick={() => handleClockIn(selectedShift.id)}
                        disabled={
                          isClockingIn ||
                          selectedShift.status === 'Completed' ||
                          (selectedShift.clockEntries?.some((e: any) => e.clockOutTime != null) ?? false) ||
                          !!activeEntry
                        }
                      >
                        {isClockingIn ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
                        {t('schedule.clockIntoShift')}
                      </Button>
                      {((selectedShift.clockEntries?.some((e: any) => e.clockOutTime != null) ?? false) || selectedShift.status === 'Completed') && (
                        <p className="text-sm text-muted-foreground mt-2 font-medium">
                          {t('schedule.shiftCompleted', 'Shift completed')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
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
