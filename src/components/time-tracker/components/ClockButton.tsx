"use client";
import { useState, useEffect, useRef, memo } from 'react';
import { Play, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimer } from '@/components/time-tracker/hooks/useTimer';
import { useGeolocation, validateGeofence } from '@/components/time-tracker/hooks/useGeolocation';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { ClockOutForm } from './ClockOutForm';
import { GeofenceWarningDialog } from './GeofenceWarningDialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { describeError } from '@/lib/describe-error';
import { formatTime } from '@/lib/format/date';

function ClockButtonComponent() {
  const { t } = useTranslation();
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [showGeofenceWarning, setShowGeofenceWarning] = useState<{distance: number, site: string, location: any} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // The ad-hoc shift THIS button created at clock-in. Only that one is closed (end time + completed)
  // at clock-out — a PLANNED shift is the planner's record and is never rewritten by clocking out.
  
  const [entriesTimedOut, setEntriesTimedOut] = useState(false);
  
  const { activeEntry, loading: entriesLoading, error: entriesError, clockIn, clockOut } = useClockEntries();
  const { getTodayShift, loading: shiftsLoading, error: shiftsError, failedEndpoints, refetch: refetchShifts } = useScheduledShifts({ kind: 'crew' });
  const { formattedTime, isRunning, startTimer, stopTimer, resetTimer, setStartTime } = useTimer();
  const { requestLocation, loading: locationLoading, permissionState, explainerDialog } = useGeolocation();

  // Terminal branch (WHS-1 §2): never spin forever on the entries load.
  // Shifts have NO timeout here (WHS-1b §2): useScheduledShifts owns its own 9s bound, and a
  // second, shorter guess here turned "slow" into "no shift today" and created duplicate shifts.
  useEffect(() => {
    const tEntries = setTimeout(() => setEntriesTimedOut(true), 5000);
    return () => clearTimeout(tEntries);
  }, []);

  const shiftsFailed = Boolean(shiftsError || failedEndpoints?.includes('shifts'));
  // WHS-1b §1: an empty entries list we did not successfully load is NOT "clocked out".
  // The button still offers clock-in (the server refuses a second open entry), with a note.
  const entriesUnconfirmed = (entriesLoading && entriesTimedOut) || Boolean(entriesError);

  const todayShift = getTodayShift();
  const hasScheduledShift = !!todayShift;

  // Track if we've initialized the timer for this entry
  const initializedEntryRef = useRef<string | null>(null);

  const isClockedIn = !!activeEntry;

  // Restore timer from active entry - only once per entry
  useEffect(() => {
    if (activeEntry && initializedEntryRef.current !== activeEntry.id) {
      const clockInTime = new Date(activeEntry.clockInTime);
      setStartTime(clockInTime);
      if (!isRunning) {
        startTimer(clockInTime);
      }
      initializedEntryRef.current = activeEntry.id;
    } else if (!activeEntry && initializedEntryRef.current !== null) {
      resetTimer();
      initializedEntryRef.current = null;
    }
  }, [activeEntry?.id]);

  const handleClockIn = async () => {
    await performClockIn();
  };

  const performClockIn = async (overrideShiftWithFallback = false, skipLocation = false) => {
    setIsProcessing(true);
    const location = skipLocation ? null : (showGeofenceWarning?.location || await requestLocation());
    
    // Validate Geofence FIRST
    if (!overrideShiftWithFallback && todayShift?.project?.latitude && todayShift?.project?.longitude && location) {
      const fence = validateGeofence(
        { latitude: location.latitude, longitude: location.longitude, accuracy: 0 },
        todayShift.project.latitude,
        todayShift.project.longitude,
        200 // 200m radius
      );
      if (!fence.withinFence) {
        setShowGeofenceWarning({
          distance: fence.distanceMeters,
          site: todayShift.project.name || 'site',
          location
        });
        setIsProcessing(false);
        return; // Halt clock in
      }
    }

    const clockInData: Record<string, any> = {};
    if (location) {
      clockInData.clockInLatitude = location.latitude;
      clockInData.clockInLongitude = location.longitude;
    }
    
    // NO ad-hoc shifts (Florin 2026-10-04): no planned shift (or the crew member chose "without shift") →
    // the entry is recorded WITHOUT a shift, pending approval. The crew member's clock-out note says why;
    // the admin may plan a shift in the past to match it. Nothing is invented here.
    const withoutShift = overrideShiftWithFallback || !todayShift?.id;
    if (withoutShift) {
      clockInData.requiresApproval = true;
      clockInData.approvalStatus = 'pending';
    } else {
      clockInData.shiftId = todayShift!.id;
    }

    const { data, error, alreadyClockedIn } = await clockIn(clockInData);
    
    if (error) {
      console.error('[ClockButton] Clock-in failed:', error);
      setIsProcessing(false);
      toast.error(`Failed to clock in. Please try again. — ${describeError(error)}`);
      return;
    }

    // WHS-1b §1: the server already had an open entry for this worker — adopted, nothing created.
    if (alreadyClockedIn && data) {
      setIsProcessing(false);
      setShowGeofenceWarning(null);
      toast.info(t('clock.alreadyClockedInSince', { time: formatTime(new Date(data.clockInTime)) }));
      return;
    }
    
    try {
      await refetchShifts();
    } catch {}
    setIsProcessing(false);
    setShowGeofenceWarning(null);

    if (withoutShift) {
      toast.success('Clocked in without shift', {
        description: 'Entry requires manager approval',
      });
    } else if (location) {
      toast.success('On-site confirmed', {
        description: `Clocked into scheduled shift`,
      });
    } else {
      toast.success(hasScheduledShift ? 'Clocked in successfully!' : 'Clocked in without scheduled shift');
    }
  };


  const handleClockOut = () => {
    setShowClockOutForm(true);
  };

  const handleClockOutSubmit = async (data: { taskDescription: string; photos: File[]; noBreak: boolean }) => {
    setIsProcessing(true);
    const location = await requestLocation();
    
    const { error } = await clockOut({
      taskDescription: data.taskDescription,
      clockOutLatitude: location?.latitude,
      clockOutLongitude: location?.longitude,
      photos: data.photos,
      noBreak: data.noBreak
    });
    
    await refetchShifts();
    setIsProcessing(false);
    setShowClockOutForm(false);
    
    if (error) {
      toast.error('Failed to clock out. Please try again.');
      return;
    }
    
    stopTimer();
    const breakNote = data.noBreak ? '' : ' (30-min break deducted)';
    toast.success('Clocked out successfully!', {
      description: `Worked for ${formattedTime}${breakNote}`,
    });
    resetTimer();
  };

  // Terminal branch (WHS-1 §2): never block indefinitely on loading
  const isAwaitingInitialEntries = entriesLoading && !entriesTimedOut;
  const isAwaitingShifts = !isClockedIn && shiftsLoading && !shiftsFailed;

  if (isAwaitingInitialEntries || isAwaitingShifts) {
    return (
      <div className="w-full">
        <Button
          size="lg"
          disabled
          className="w-full h-14 md:h-16 rounded-xl md:rounded-2xl opacity-60 bg-muted text-muted-foreground flex items-center justify-center shadow-lg"
        >
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="w-full flex flex-col items-center">
        <Button
          size="lg"
          onClick={isClockedIn ? handleClockOut : handleClockIn}
          disabled={locationLoading || isProcessing}
          style={{
            backgroundColor: isClockedIn 
              ? 'var(--tawny)' 
              : (hasScheduledShift ? 'var(--persian-green)' : 'var(--tawny)'),
          }}
          className={`
            w-full h-14 md:h-16 px-6 text-base md:text-lg font-bold rounded-xl md:rounded-2xl transition-all duration-300 shadow-xl hover:brightness-110 active:scale-[0.98] text-white flex items-center justify-center
            ${isClockedIn ? 'btn-clock-out' : 'btn-clock-in'}
          `}
        >
          {locationLoading || isProcessing ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 md:w-6 h-6 mr-3 animate-spin" />
              <span>{t('clock.processing')}</span>
            </div>
          ) : isClockedIn ? (
            <div className="flex flex-col items-center justify-center w-full leading-tight">
              <div className="flex items-center text-sm font-semibold uppercase tracking-wider opacity-90 mb-0.5">
                <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                {t('clock.clockOut')}
              </div>
              <div className="text-2xl md:text-3xl font-black tabular-nums tracking-wider font-mono">
                {formattedTime}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Play className="w-5 h-5 md:w-6 h-6 mr-2.5 fill-current" />
              <span>{hasScheduledShift ? t('schedule.clockIntoShift') : t('schedule.clockInWithoutShift')}</span>
            </div>
          )}
        </Button>

        {/* Short-notice changes: a shift is planned, but today the work is elsewhere / different.
            Recorded without a shift, pending approval — HR attributes it later (pd.md 4x). */}
        {!isClockedIn && hasScheduledShift && (
          <button
            type="button"
            onClick={() => performClockIn(true)}
            disabled={locationLoading || isProcessing}
            className="mt-2 h-11 px-5 rounded-full text-base font-semibold bg-white/95 dark:bg-neutral-900/95 text-[var(--tawny)] border border-[var(--tawny)]/40 shadow-md disabled:opacity-50"
          >
            {t('schedule.clockInWithoutShift')}
          </button>
        )}

        {!isClockedIn && shiftsFailed && (
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-2 text-center bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
            {t('schedule.shiftsUnavailableNotice')}
          </p>
        )}

        {!isClockedIn && entriesUnconfirmed && (
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-2 text-center bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
            {t('clock.statusUnconfirmed')}
          </p>
        )}
      </div>

      {explainerDialog}

      <GeofenceWarningDialog
        open={!!showGeofenceWarning}
        distanceMeters={showGeofenceWarning?.distance || 0}
        siteName={showGeofenceWarning?.site || ''}
        onCancel={() => setShowGeofenceWarning(null)}
        onClockWithoutShift={() => performClockIn(true)}
      />

      <ClockOutForm
        open={showClockOutForm}
        onClose={() => setShowClockOutForm(false)}
        onSubmit={handleClockOutSubmit}
        elapsedTime={formattedTime}
      />
    </>
  );
}

export const ClockButton = memo(ClockButtonComponent);
