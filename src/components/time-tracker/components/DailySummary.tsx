// @ts-nocheck
"use client";
import { useMemo } from 'react';
import {
  MapPin, Clock, Briefcase, Navigation, CheckSquare,
  Sun, Cloud, CloudRain, Thermometer, ChevronRight,
  CalendarDays, Users
} from 'lucide-react';
import { Link } from "@/i18n/routing";
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useScheduledShifts, ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import { format, isToday, isTomorrow, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';

function openMapsApp(address: string) {
  const encodedAddress = encodeURIComponent(address);
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  if (isIOS) {
    window.open(`maps://maps.apple.com/?q=${encodedAddress}`, '_blank');
  } else if (isAndroid) {
    window.open(`geo:0,0?q=${encodedAddress}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }
}

function formatShiftDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatTime12(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

export function DailySummary() {
  const { user } = useAuth();
  const { shifts, loading } = useScheduledShifts();

  // Find today's shift for the current user
  const todayShift = useMemo(() => {
    if (!user?.id || !shifts.length) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    return shifts.find(s => s.user_id === user.id && s.shift_date === today) || null;
  }, [shifts, user?.id]);

  // Get tasks for today's shift
  const { shiftTasks, loading: tasksLoading } = useShiftTasks(todayShift?.id || '');
  const pendingTasks = shiftTasks.filter(st => st.status === 'pending');
  const completedTasks = shiftTasks.filter(st => st.status === 'completed');

  // Tomorrow's shift
  const tomorrowShift = useMemo(() => {
    if (!user?.id || !shifts.length) return null;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    return shifts.find(s => s.user_id === user.id && s.shift_date === tomorrowStr) || null;
  }, [shifts, user?.id]);

  if (loading) return null;

  // No shift today — show a minimal card
  if (!todayShift) {
    return (
      <section className="w-full animate-fade-in">
        <h2 className="text-xl font-semibold text-foreground mb-4">Today's Overview</h2>
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">No shift scheduled today</p>
              <p className="text-sm text-muted-foreground">
                {tomorrowShift
                  ? `Next shift: Tomorrow at ${formatTime12(tomorrowShift.shift_start)}`
                  : 'Check your schedule for upcoming shifts'}
              </p>
            </div>
            <Link
              href="/admin/hr/time-tracker/schedule"
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              Schedule
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const duration = formatShiftDuration(todayShift.shift_start, todayShift.shift_end);
  const hasProject = !!todayShift.project;
  const hasAddress = !!todayShift.project?.address;
  const hasTasks = shiftTasks.length > 0;
  const taskProgress = shiftTasks.length > 0
    ? Math.round((completedTasks.length / shiftTasks.length) * 100)
    : 0;

  return (
    <section className="w-full animate-fade-in">
      <h2 className="text-xl font-semibold text-foreground mb-4">Today's Overview</h2>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header stripe */}
        <div className="bg-primary/5 border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {format(new Date(), 'EEEE, MMMM d')}
              </p>
              <p className="text-xs text-muted-foreground">
                {todayShift.status === 'Completed' ? '✅ Completed' :
                 todayShift.status === 'In Progress' ? '🟢 In Progress' :
                 '⏳ Scheduled'}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            todayShift.status === 'Completed'
              ? 'bg-secondary/20 text-secondary'
              : todayShift.status === 'In Progress'
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
          }`}>
            {todayShift.status}
          </span>
        </div>

        {/* Main content */}
        <div className="p-6 space-y-4">
          {/* Shift time + duration */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Shift</p>
              <p className="font-semibold text-foreground">
                {formatTime12(todayShift.shift_start)} – {formatTime12(todayShift.shift_end)}
              </p>
            </div>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {duration}
            </span>
          </div>

          {/* Project */}
          {hasProject && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Project</p>
                <p className="font-semibold text-foreground">{todayShift.project.name}</p>
              </div>
            </div>
          )}

          {/* Location with navigation */}
          {hasAddress && (
            <button
              onClick={() => openMapsApp(todayShift.project!.address!)}
              className="w-full flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-primary/5 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <MapPin className="w-5 h-5 text-[var(--brand-color,#d35400)]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {todayShift.project!.address}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <Navigation className="w-4 h-4" />
                <span className="text-xs font-semibold">Navigate</span>
              </div>
            </button>
          )}

          {/* Role */}
          {todayShift.role && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-semibold text-foreground">{todayShift.role}</p>
              </div>
            </div>
          )}

          {/* Task progress */}
          {hasTasks && !tasksLoading && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Tasks</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {completedTasks.length}/{shiftTasks.length} done
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              {/* Pending task list (max 3) */}
              {pendingTasks.length > 0 && (
                <div className="space-y-1 pt-1">
                  {pendingTasks.slice(0, 3).map(st => (
                    <div key={st.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      <span className="truncate">{st.task?.title || 'Untitled task'}</span>
                    </div>
                  ))}
                  {pendingTasks.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-3.5">
                      +{pendingTasks.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {todayShift.notes && (
            <div className="bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">📝 Notes</p>
              <p className="text-sm text-foreground">{todayShift.notes}</p>
            </div>
          )}
        </div>

        {/* Tomorrow preview footer */}
        {tomorrowShift && (
          <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-muted/20">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Tomorrow:</span>{' '}
              {formatTime12(tomorrowShift.shift_start)} – {formatTime12(tomorrowShift.shift_end)}
              {tomorrowShift.project?.name && ` · ${tomorrowShift.project.name}`}
            </div>
            <Link
              href="/admin/hr/time-tracker/schedule"
              className="text-primary text-xs font-medium flex items-center gap-0.5 hover:underline"
            >
              View
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
