"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Clock, Loader2, Play } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useGeolocation, validateGeofence } from '@/components/time-tracker/hooks/useGeolocation';
import { GeofenceWarningDialog } from './GeofenceWarningDialog';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { format, parseISO, isToday, addDays, subDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { formatTime, formatWeekdayDayMonth } from '@/lib/format/date';
import { describeError } from '@/lib/describe-error';
import { shiftBrief, type ShiftBriefResult } from '@/lib/data/shift-brief';
import { ShiftBriefDetails } from '@/components/workhub/ShiftBriefDetails';
import FileViewer, { type ViewableFile } from '@/components/files/FileViewer';
import { shiftTemporalState, compareShifts, isShiftSubmitted } from '@/lib/kernel/shift-time';
import { submitShift } from '@/lib/data/shift-submit';

// Shift time is kernel (kernel/shift-time): built from parts, local, one definition for list + clock.
const getShiftTemporalState = (shiftDate: string, shiftStart: string, shiftEnd: string, now: Date) =>
  shiftTemporalState({ shiftDate, shiftStart, shiftEnd }, now);

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
  const { t, i18n } = useTranslation();
  // WH-2: tasks, address and attachments live in the Shift Brief modal, not on the card —
  // which also drops two requests per card (shift-tasks + the whole erp-tasks list).

  const isClockedIn = Boolean(activeEntry && activeEntry.shiftId === shift?.id);
  const shiftDate = parseISO(shift.shiftDate);
  const temporalState = getShiftTemporalState(shift.shiftDate, shift.shiftStart, shift.shiftEnd, now);
  const isPast = temporalState === 'past';

  // 3-step fallback chain: Project name -> description (shiftName / notes) -> localized 'shift'
  const projectName = (shift.project?.name || shift.projectName || '').replace(/^\[ERP\]\s*/i, '').trim();
  const description = (shift.shiftName || '').trim() || (shift.notes || '').trim();
  const fallback = t('schedule.shiftFallback');
  const primaryTitle = projectName || description || fallback;

  return (
    <Card 
      // WH-2: a card per shift (Florin: a border-separated list is hard to read). Past shifts stay
      // legible — the grey rail says "past"; fading the whole card made the rail itself disappear.
      className={`relative overflow-hidden pl-3 rounded-2xl border bg-card shadow-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors ${isClockedIn ? 'ring-2 ring-[var(--tawny)]' : ''} ${isNextShift ? 'border-primary' : ''} ${isPast ? 'opacity-80' : ''}`}
      onClick={onClick}
    >
      {/* 3-4px vertical rule state bar on the left edge (WH-UI-1 §9.3) */}
      <div 
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-2 ${
          temporalState === 'current'
            ? 'bg-[var(--tawny)]'
            : temporalState === 'upcoming'
              ? 'bg-[var(--persian-green)]'
              : 'bg-neutral-400 dark:bg-neutral-600'
        }`}
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* WH-2: min-w-0 — without it this column kept the address's full one-line width, the page
              grew wider than the phone, and iOS zoomed the whole app out to ~75% (every font with it). */}
          <div className="space-y-1.5 flex-1 min-w-0">
            {/* Primary line: Project Name */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-foreground leading-snug break-words min-w-0">
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

            {/* Third line: Time and Date with elapsed time above date (WH-UI-1 §9.4) */}
            <div className="flex items-end justify-between gap-3 text-base text-muted-foreground mt-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
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
                      : formatWeekdayDayMonth(shiftDate, i18n.language)}
                  </span>
                  {isNextShift && !isToday(shiftDate) && (
                    <Badge variant="outline" className="text-sm font-normal py-0 px-2">{t('schedule.next')}</Badge>
                  )}
                </div>
                {/* Accountability: a worked shift waits for its worker to submit it */}
                {isShiftSubmitted(shift.status) ? (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-[var(--persian-green)]/10 text-[var(--persian-green)]">
                    ✓ {t('schedule.submitted')}
                  </span>
                ) : (shift.clockEntries || []).some((e: { clockOutTime?: string | null }) => e.clockOutTime != null) ? (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-[var(--tawny)]/10 text-[var(--tawny)]">
                    {t('schedule.toSubmit')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

export function MySchedule() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isManager } = useUserRoles();
  const { shifts, loading, error, failedEndpoints, refetch: refetchShifts } = useScheduledShifts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { activeEntry, clockIn, clockOut } = useClockEntries();
  const { location, requestLocation } = useGeolocation();
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [showGeofenceWarning, setShowGeofenceWarning] = useState<{distance: number, site: string, location: any, shiftId: string} | null>(null);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [brief, setBrief] = useState<ShiftBriefResult | null>(null);
  const [viewer, setViewer] = useState<{ files: ViewableFile[]; index: number } | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [now, setNow] = useState(() => new Date());
  const nextShiftRef = useRef<HTMLDivElement>(null);

  // Live timer derived from activeEntry.clockInTime (WHS-1 §3)
  useEffect(() => {
    if (!activeEntry?.clockInTime) {
      setElapsedTime('00:00:00');
      return;
    }
    const update = () => {
      const start = new Date(activeEntry.clockInTime).getTime();
      const diff = Math.max(0, Date.now() - start);
      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      setElapsedTime(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.clockInTime]);

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
      // Chronological by date AND start time (was date only — same-day shifts came in creation order).
      .sort(compareShifts);
  }, [shifts, user?.id, rangeStartStr, rangeEndStr]);

  // Find the next upcoming shift (today or future)
  // The first shift that is not over yet (running or upcoming) — by time, not just by date.
  const nextShiftIndex = useMemo(() => {
    const idx = filteredShifts.findIndex(s => shiftTemporalState(s, now) !== 'past');
    return idx >= 0 ? idx : filteredShifts.length - 1;
  }, [filteredShifts, now]);

  const nextShift = filteredShifts[nextShiftIndex];

  // Scroll to the next shift ONCE per load — the index now follows the clock (a shift ending moves it),
  // and re-scrolling then would yank the list from under the worker's thumb.
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (didScrollRef.current || loading || !nextShiftRef.current) return;
    didScrollRef.current = true;
    setTimeout(() => {
      nextShiftRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, 100);
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

      const { data, error, alreadyClockedIn } = await clockIn(clockInData);
      
      if (error) {
        console.error('[MySchedule] Clock-in failed:', error);
        toast.error(`Failed to clock in — ${describeError(error)}`);
      } else if (alreadyClockedIn && data) {
        // WHS-1b §1: the server already had an open entry — adopted, nothing created.
        toast.info(t('clock.alreadyClockedInSince', { time: formatTime(new Date(data.clockInTime)) }));
        setShowGeofenceWarning(null);
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

  const handleSubmitShift = async (shiftId: string) => {
    if (!window.confirm(t('schedule.submitConfirm'))) return;
    setIsSubmitting(true);
    try {
      const res = await submitShift(shiftId);
      if (res.ok) {
        toast.success(t('schedule.submittedToast'));
        setSelectedShift((s: any) => (s && s.id === shiftId ? { ...s, status: 'completed' } : s));
        await refetchShifts();
      } else {
        console.error('[MySchedule] submit refused:', res);
        toast.error(`${t(`schedule.submitError.${res.error}`)}${res.detail ? ` — ${res.detail}` : ''}`);
      }
    } catch (err) {
      console.error('[MySchedule] submit failed:', err);
      toast.error(`${t('schedule.submitError.failed')} — ${describeError(err)}`);
    } finally {
      setIsSubmitting(false);
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
        <CardDescription className="text-base">
          {filteredShifts.length > 0 
            ? `${t('schedule.shiftCount', { count: filteredShifts.length })} · ${t('schedule.rangeHint')}`
            : t('schedule.noShiftsScheduled')}
        </CardDescription>

        {failedEndpoints && failedEndpoints.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-base leading-none">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold">
                  {failedEndpoints.includes('shifts') 
                    ? t('schedule.shiftsLoadFailed')
                    : t('schedule.partialDataNotice')}
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {failedEndpoints.includes('shifts')
                    ? t('schedule.shiftsLoadFailedHint')
                    : `${t('schedule.unloadedEndpoints')}: ${failedEndpoints.map(e => t(`schedule.endpoint.${e}`, { defaultValue: e })).join(', ')}. ${t('schedule.partialDataExplanation')}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {filteredShifts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 px-4 text-sm">
            {t('schedule.noShiftsScheduledPeriod')}
          </p>
        ) : (
          <div className="space-y-3 px-3 py-3 md:p-4">
            {filteredShifts.map((shift, index) => (
              <div 
                key={shift.id} 
                ref={index === nextShiftIndex ? nextShiftRef : undefined}
                // WH-2: the shell's header is sticky (h-14) — land the next shift BELOW it, not under it
                className="scroll-mt-14 md:scroll-mt-28"
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
      {/* While the carousel is open the brief steps aside (and returns when it closes): a full-screen
          viewer cannot live inside Radix's transformed dialog content. */}
      <Dialog open={!!selectedShift && !viewer} onOpenChange={(open) => { if (!open && !viewer) setSelectedShift(null); }}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden font-content">
          {selectedShift && (() => {
            const shiftDateObj = parseISO(selectedShift.shiftDate);
            const scheduledDateStr = isToday(shiftDateObj) 
              ? t('schedule.today') 
              : formatWeekdayDayMonth(shiftDateObj, i18n.language, true);
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
                  {/* WH-2: address · contact · notes · tasks · attachments — each rendered by what it is */}
                  <ShiftBriefDetails
                    shiftId={selectedShift.id}
                    brief={brief}
                    fallbackAddress={addressText}
                    title={displayTitle}
                    userId={user?.id}
                    onOpenMedia={(files, index) => setViewer({ files, index })}
                  />

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

                  {briefLoading && !brief && (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Clock Action Surface */}
                <div className="p-4 border-t border-neutral-100 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col items-center">
                  {isShiftSubmitted(selectedShift.status) ? (
                    <p className="w-full text-center py-3 text-base font-semibold text-[var(--persian-green)]">
                      ✓ {t('schedule.submittedLong')}
                    </p>
                  ) : activeEntry && activeEntry.shiftId === selectedShift.id ? (
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
                        // A shift can be worked more than once (Florin: twice at one site in a day).
                        // Only an OPEN entry blocks — and the server refuses a second open one anyway.
                        disabled={isClockingIn || !!activeEntry}
                      >
                        {isClockingIn ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
                        {(selectedShift.clockEntries?.some((e: { clockOutTime?: string | null }) => e.clockOutTime != null) ?? false)
                          ? t('schedule.clockInAgain')
                          : t('schedule.clockIntoShift')}
                      </Button>
                      {/* THE ONE DOOR that completes a shift — the worker's own accountable act */}
                      {(selectedShift.clockEntries?.some((e: { clockOutTime?: string | null }) => e.clockOutTime != null) ?? false) && (
                        <Button
                          variant="outline"
                          className="w-full h-14 mt-3 text-base font-bold rounded-xl border-2 border-[var(--persian-green)] text-[var(--persian-green)]"
                          onClick={() => handleSubmitShift(selectedShift.id)}
                          disabled={isSubmitting || !!activeEntry}
                        >
                          {isSubmitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                          {t('schedule.submitShift')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      {viewer && (
        <FileViewer
          files={viewer.files}
          index={viewer.index}
          onIndexChange={(index) => setViewer(v => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
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
