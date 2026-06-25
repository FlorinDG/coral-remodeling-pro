// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useState, useEffect, useRef, memo } from 'react';
import { Play, Square, MapPin, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimer } from '@/components/time-tracker/hooks/useTimer';
import { useGeolocation, validateGeofence } from '@/components/time-tracker/hooks/useGeolocation';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { ClockOutForm } from './ClockOutForm';
import { LocationPermissionDialog } from './LocationPermissionDialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

function ClockButtonComponent() {
  const { t } = useTranslation();
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
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
    if (activeEntry && todayShift?.clock_entry_id === activeEntry.id) {
      setActiveShiftId(todayShift.id);
    } else if (activeEntry && todayShift?.status === 'In Progress') {
      setActiveShiftId(todayShift.id);
    }
  }, [activeEntry?.id, todayShift?.id, todayShift?.clock_entry_id, todayShift?.status]);

  // Restore timer from active entry - only once per entry
  useEffect(() => {
    if (activeEntry && initializedEntryRef.current !== activeEntry.id) {
      const clockInTime = new Date(activeEntry.clock_in_time);
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

  const performClockIn = async () => {
    setIsProcessing(true);
    const location = await requestLocation();
    
    // Clock in — pass location + shiftId as a single object
    const clockInData: Record<string, any> = {};
    if (location) {
      clockInData.clockInLatitude = location.latitude;
      clockInData.clockInLongitude = location.longitude;
    }
    if (todayShift?.id) {
      clockInData.shiftId = todayShift.id;
    }

    const { data, error } = await clockIn(clockInData);
    
    if (error) {
      setIsProcessing(false);
      toast.error('Failed to clock in. Please try again.');
      return;
    }
    
    // If no scheduled shift, create a user-initiated shift
    if (!todayShift && data) {
      const userShift = await createUserShift();
      if (userShift?.data) {
        setActiveShiftId(userShift.data.id);
      }
    } else if (todayShift) {
      setActiveShiftId(todayShift.id);
    }

    await refetchShifts();
    setIsProcessing(false);

    // Geofence validation (soft fence — warn but allow)
    // HrProject stores address string; lat/lng may be available via geocoding
    if (location && todayShift?.project?.latitude && todayShift?.project?.longitude) {
      const fence = validateGeofence(
        { latitude: location.latitude, longitude: location.longitude, accuracy: 0 },
        todayShift.project.latitude,
        todayShift.project.longitude,
        200 // 200m radius
      );
      if (!fence.withinFence) {
        toast.warning(`You are ${fence.distanceMeters}m from the project site`, {
          description: `Expected within ${fence.radiusMeters}m of ${todayShift.project.name || 'site'}. Clock-in recorded anyway.`,
          duration: 8000,
        });
      } else {
        toast.success('On-site confirmed', {
          description: `${fence.distanceMeters}m from ${todayShift.project.name || 'site'}`,
        });
      }
    } else if (location) {
      toast.success('Location captured', {
        description: `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`,
      });
    }

    toast.success(hasScheduledShift ? 'Clocked in successfully!' : 'Clocked in without scheduled shift');
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

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (entriesLoading || shiftsLoading) {
    return (
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="w-full flex flex-col items-center gap-4 md:gap-6">
        {isClockedIn && (
          <div className="animate-fade-in hidden md:block">
            <div className="bg-secondary/20 border border-secondary/30 rounded-2xl px-8 py-4 animate-timer-glow">
              <p className="text-sm font-medium text-muted-foreground mb-1 text-center">{t('clock.timeElapsed')}</p>
              <p className="timer-display text-4xl md:text-5xl font-bold text-primary tracking-wider">
                {formattedTime}
              </p>
            </div>
          </div>
        )}

        <div className="w-full sticky top-14 md:relative z-30 bg-background/95 dark:bg-black/95 backdrop-blur-md md:bg-transparent md:backdrop-blur-none py-3 md:py-0 px-4 md:px-0 border-b border-neutral-200/50 dark:border-white/5 md:border-0 flex justify-center">
          <Button
            size="lg"
            onClick={isClockedIn ? handleClockOut : handleClockIn}
            disabled={locationLoading || isProcessing}
            className={`
              w-full max-w-sm h-16 md:h-20 px-6 md:px-12 text-base md:text-xl font-bold rounded-xl md:rounded-2xl transition-all duration-300 shadow-md hover:scale-[1.02] active:scale-[0.98]
              ${isClockedIn 
                ? 'btn-clock-out bg-rose-600 hover:bg-rose-500 text-white animate-pulse' 
                : 'btn-clock-in bg-[var(--brand-color,#d35400)] hover:brightness-110 text-white'
              }
            `}
          >
            {locationLoading || isProcessing ? (
              <div className="flex items-center">
                <Loader2 className="w-5 h-5 md:w-6 h-6 mr-3 animate-spin" />
                <span>{t('clock.processing')}</span>
              </div>
            ) : isClockedIn ? (
              <div className="flex flex-col items-center justify-center w-full leading-tight">
                <div className="flex items-center text-[10px] md:text-xs uppercase tracking-widest opacity-90 mb-1">
                  <Square className="w-3 h-3 md:w-4 h-4 mr-1.5 fill-current" />
                  {t('clock.clockOut')}
                </div>
                <div className="text-2xl md:text-3xl font-black tabular-nums tracking-wider font-mono">
                  {formattedTime}
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <Play className="w-5 h-5 md:w-6 h-6 mr-3 fill-current" />
                <span>{hasScheduledShift ? t('clock.clockIn') : t('clock.clockInWithoutShift')}</span>
              </div>
            )}
          </Button>
        </div>

        {/* Schedule Status Display */}
        <div className="w-full max-w-sm">
          {hasScheduledShift ? (
            <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-xl border border-secondary/30">
              <Calendar className="w-5 h-5 text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t('clock.todaysShift')}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(todayShift.shift_start)} - {formatTime(todayShift.shift_end)}
                </p>
                {todayShift.project?.name && (
                  <p className="text-xs text-muted-foreground truncate">
                    {todayShift.project.name}
                    {todayShift.project.address && ` • ${todayShift.project.address}`}
                  </p>
                )}
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                todayShift.status === 'Completed' 
                  ? 'bg-secondary/20 text-secondary'
                  : todayShift.status === 'In Progress'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {todayShift.status}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">{t('clock.noScheduledShift')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('clock.userInitiatedEntry')}
                </p>
              </div>
            </div>
          )}
        </div>

        {isClockedIn && activeEntry?.clock_in_latitude && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <MapPin className="w-4 h-4" />
            <span>{t('clock.locationRecorded')}</span>
          </div>
        )}
      </div>

      <LocationPermissionDialog
        open={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onGranted={handleLocationPermissionGranted}
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
