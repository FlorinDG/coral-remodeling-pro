"use client";
import { useState, useEffect, useRef, memo } from 'react';
import { Play, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimer } from '@/components/time-tracker/hooks/useTimer';
import { useGeolocation, validateGeofence } from '@/components/time-tracker/hooks/useGeolocation';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { ClockOutForm } from './ClockOutForm';
import { LocationPermissionDialog } from './LocationPermissionDialog';
import { GeofenceWarningDialog } from './GeofenceWarningDialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

function ClockButtonComponent() {
  const { t } = useTranslation();
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showGeofenceWarning, setShowGeofenceWarning] = useState<{distance: number, site: string, location: any} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  
  const { activeEntry, loading: entriesLoading, clockIn, clockOut } = useClockEntries();
  const { getTodayShift, createUserShift, completeUserShift, loading: shiftsLoading, refetch: refetchShifts } = useScheduledShifts();
  const { formattedTime, isRunning, startTimer, stopTimer, resetTimer, setStartTime } = useTimer();
  const { requestLocation, loading: locationLoading, permissionState } = useGeolocation();

  const todayShift = getTodayShift();
  const hasScheduledShift = !!todayShift;

  // Track if we've initialized the timer for this entry
  const initializedEntryRef = useRef<string | null>(null);

  const isClockedIn = !!activeEntry;

  // Track the active shift when clocked in
  useEffect(() => {
    if (activeEntry && activeEntry.shiftId === todayShift?.id) {
      setActiveShiftId(todayShift.id);
    } else if (activeEntry && todayShift?.status === 'In Progress') {
      setActiveShiftId(todayShift.id);
    }
  }, [activeEntry?.id, activeEntry?.shiftId, todayShift?.id, todayShift?.status]);

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
    if (permissionState === 'prompt') {
      setShowLocationDialog(true);
      return;
    }
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
    
    if (overrideShiftWithFallback) {
      clockInData.requiresApproval = true;
      clockInData.approvalStatus = 'pending';
    } else if (todayShift?.id) {
      clockInData.shiftId = todayShift.id;
    }

    const { data, error } = await clockIn(clockInData);
    
    if (error) {
      console.error('[ClockButton] Clock-in failed:', error);
      setIsProcessing(false);
      toast.error('Failed to clock in. Please try again.');
      return;
    }
    
    // If no scheduled shift, create a user-initiated shift
    if (!todayShift && data && !overrideShiftWithFallback) {
      const userShift = await createUserShift();
      if (userShift?.data) {
        setActiveShiftId(userShift.data.id);
        
        // Link the newly created shift to the clock entry
        try {
          await fetch(`/api/hr/clock-entries?id=${data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shiftId: userShift.data.id }),
          });
        } catch (patchErr) {
          console.error('[ClockButton] Failed to link shift to clock entry:', patchErr);
        }
      }
    } else if (todayShift && !overrideShiftWithFallback) {
      setActiveShiftId(todayShift.id);
    }

    await refetchShifts();
    setIsProcessing(false);
    setShowGeofenceWarning(null);

    if (overrideShiftWithFallback) {
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

  const handleLocationPermissionGranted = async () => {
    setShowLocationDialog(false);
    await performClockIn();
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
    
    // If this was a user-created shift, update the end time
    if (activeShiftId) {
      await completeUserShift(activeShiftId);
    }

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
    setActiveShiftId(null);
  };

  if (entriesLoading || shiftsLoading) {
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
      </div>

      <LocationPermissionDialog
        open={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onDecline={() => {
          setShowLocationDialog(false);
          performClockIn(false, true);
        }}
        onGranted={handleLocationPermissionGranted}
      />

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
