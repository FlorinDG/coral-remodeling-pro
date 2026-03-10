"use client";
import { useState, useEffect, useRef, memo } from 'react';
import { Play, Square, MapPin, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { useTimer } from '@/components/time-tracker/hooks/useTimer';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { ClockOutForm } from './ClockOutForm';
import { LocationPermissionDialog } from './LocationPermissionDialog';
import { toast } from 'sonner';

function ClockButtonComponent() {
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
    
    // Clock in and link to scheduled shift if exists
    const { data, error } = await clockIn(
      location ? { latitude: location.latitude, longitude: location.longitude } : null,
      todayShift?.id || null
    );
    
    if (error) {
      setIsProcessing(false);
      toast.error('Failed to clock in. Please try again.');
      return;
    }
    
    // If no scheduled shift, create a user-initiated shift
    if (!todayShift && data) {
      const userShift = await createUserShift(data.id);
      if (userShift) {
        setActiveShiftId(userShift.id);
      }
    } else if (todayShift) {
      setActiveShiftId(todayShift.id);
    }

    await refetchShifts();
    setIsProcessing(false);
    
    if (location) {
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
    
    const { error } = await clockOut(
      data.taskDescription,
      location ? { latitude: location.latitude, longitude: location.longitude } : null,
      activeShiftId,
      data.noBreak
    );
    
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
      <div className="flex flex-col items-center gap-6">
        {isClockedIn && (
          <div className="animate-fade-in">
            <div className="bg-secondary/20 border border-secondary/30 rounded-2xl px-8 py-4 animate-timer-glow">
              <p className="text-sm font-medium text-muted-foreground mb-1 text-center">Time Elapsed</p>
              <p className="timer-display text-4xl md:text-5xl font-bold text-primary tracking-wider">
                {formattedTime}
              </p>
            </div>
          </div>
        )}

        <Button
          size="lg"
          onClick={isClockedIn ? handleClockOut : handleClockIn}
          disabled={locationLoading || isProcessing}
          className={`
            h-20 px-12 text-xl font-semibold rounded-2xl transition-all duration-300
            ${isClockedIn 
              ? 'btn-clock-out' 
              : 'btn-clock-in'
            }
          `}
        >
          {locationLoading || isProcessing ? (
            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
          ) : isClockedIn ? (
            <Square className="w-6 h-6 mr-3" />
          ) : (
            <Play className="w-6 h-6 mr-3" />
          )}
          {locationLoading || isProcessing 
            ? 'Processing...' 
            : isClockedIn 
              ? 'Clock Out' 
              : hasScheduledShift 
                ? 'Clock In' 
                : 'Clock In Without Shift'
          }
        </Button>

        {/* Schedule Status Display */}
        <div className="w-full max-w-sm">
          {hasScheduledShift ? (
            <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-xl border border-secondary/30">
              <Calendar className="w-5 h-5 text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Today's Shift</p>
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
                <p className="text-sm font-medium text-muted-foreground">No Scheduled Shift</p>
                <p className="text-xs text-muted-foreground">
                  Clocking in will create a user-initiated entry
                </p>
              </div>
            </div>
          )}
        </div>

        {isClockedIn && activeEntry?.clock_in_latitude && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <MapPin className="w-4 h-4" />
            <span>Location recorded</span>
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
