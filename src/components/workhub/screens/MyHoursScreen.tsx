"use client";
/**
 * WH-2 · WorkHub — My hours. A week at a time, Monday first (LOC-1), built for the phone.
 * Replaces the admin Performance page the crew was shown. Reads the same clock-entry query the
 * clock button already holds (useClockEntries) — no new endpoint, no second source.
 * Durations come from the kernel (computeWorkedDuration: the canonical break rule), never re-derived.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Clock, FileSpreadsheet, FileText } from 'lucide-react';
import { LateEntryCard } from '@/components/time-tracker/components/LateEntryCard';
import { startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useClockEntries, type ClockEntry } from '@/components/time-tracker/hooks/useClockEntries';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { computeWorkedDuration, formatWorkDuration } from '@/lib/computeWorkedDuration';
import { formatTime, formatWeekdayDayMonth, formatDayMonth, formatMonthYear, WEEK_STARTS_ON } from '@/lib/format/date';
import { describeError } from '@/lib/describe-error';

type Review = 'approved' | 'pending' | 'rejected' | 'unreviewed';
function reviewOf(e: ClockEntry): Review {
  const s = (e.approvalStatus || '').toLowerCase();
  if (s === 'approved' || s === 'rejected' || s === 'pending') return s;
  return 'unreviewed';
}

const RAIL: Record<Review, string> = {
  approved: 'bg-[var(--persian-green)]',
  pending: 'bg-[var(--tawny)]',
  rejected: 'bg-red-500',
  unreviewed: 'bg-neutral-400 dark:bg-neutral-600',
};
const PILL: Record<Review, string> = {
  approved: 'bg-[var(--persian-green)]/10 text-[var(--persian-green)]',
  pending: 'bg-[var(--tawny)]/10 text-[var(--tawny)]',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  unreviewed: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400',
};

const hoursLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

export function MyHoursScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const { entries, loading, error, refetch } = useClockEntries();
  const [weekOffset, setWeekOffset] = useState(0);
  const [exportMonth, setExportMonth] = useState(0); // 0 = this month, 1 = last month, …

  // Export = the ONE official sheet (/api/hr/timesheet-export — WH-EXPORT-1). Month boundaries are
  // the phone's LOCAL midnight, sent as instants; workerIds[]=me keeps a team lead's sheet personal.
  const exportHref = (fmt: 'xlsx' | 'pdf') => {
    const m = subMonths(new Date(), exportMonth);
    const qs = new URLSearchParams({ format: fmt, from: startOfMonth(m).toISOString(), to: endOfMonth(m).toISOString() });
    if (user?.id) qs.append('workerIds[]', user.id);
    return `/api/hr/timesheet-export?${qs.toString()}`;
  };

  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }), weekOffset * 7),
    [weekOffset],
  );
  const weekEnd = addDays(weekStart, 7);

  // The query returns the caller's REACH (a team lead sees their team) — this screen is "my" hours.
  const mine = useMemo(
    () => entries.filter(e => e.userId === user?.id),
    [entries, user?.id],
  );

  const days = useMemo(() => {
    const inWeek = mine
      .filter(e => {
        const d = new Date(e.clockInTime);
        return d >= weekStart && d < weekEnd;
      })
      .sort((a, b) => new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime());
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      .map(day => ({ day, entries: inWeek.filter(e => isSameDay(new Date(e.clockInTime), day)) }))
      .filter(d => d.entries.length > 0);
  }, [mine, weekStart, weekEnd]);

  const totalMinutes = useMemo(
    () => days.flatMap(d => d.entries).reduce(
      (sum, e) => sum + computeWorkedDuration(e.clockInTime, e.clockOutTime, e.noBreak || false).totalMinutes, 0),
    [days],
  );

  const weekLabel = weekOffset === 0
    ? t('hours.thisWeek')
    : `${formatDayMonth(weekStart, lang)} – ${formatDayMonth(addDays(weekStart, 6), lang)}`;

  return (
    <div className="pb-6">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-foreground">{t('hours.title')}</h1>
      </div>

      {/* Forgot to clock? — the crew's late-entry flow, unchanged (pending approval). */}
      <div className="px-3 pb-3">
        <LateEntryCard />
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <button type="button" onClick={() => setWeekOffset(w => w - 1)} aria-label={t('hours.previousWeek')}
          className="h-12 w-12 rounded-full border border-border flex items-center justify-center active:scale-95">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{weekLabel}</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{hoursLabel(totalMinutes)}</p>
        </div>
        <button type="button" onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0}
          aria-label={t('hours.nextWeek')}
          className="h-12 w-12 rounded-full border border-border flex items-center justify-center active:scale-95 disabled:opacity-30">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="mx-3 mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          <p className="font-semibold">{t('hours.loadFailed')}</p>
          <p className="text-xs mt-0.5 break-words">{describeError(error)}</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-semibold underline">{t('timeOff.retry')}</button>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="space-y-3 px-3 animate-pulse">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-muted/60" />)}
        </div>
      ) : days.length === 0 && !error ? (
        <div className="flex flex-col items-center text-center px-8 py-16 text-muted-foreground">
          <Clock className="w-12 h-12 mb-3" />
          <p className="text-base">{t('hours.noEntries')}</p>
        </div>
      ) : (
        <div className="space-y-4 px-3">
          {days.map(({ day, entries: dayEntries }) => (
            <section key={day.toISOString()} className="space-y-2">
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {formatWeekdayDayMonth(day, lang)}
              </h2>
              {dayEntries.map(e => {
                const running = !e.clockOutTime;
                const d = computeWorkedDuration(e.clockInTime, e.clockOutTime, e.noBreak || false);
                const review = reviewOf(e);
                return (
                  <div key={e.id} className="relative overflow-hidden pl-5 pr-4 py-4 rounded-2xl border border-border bg-card shadow-sm">
                    <span className={`absolute left-0 top-0 bottom-0 w-2 ${running ? 'bg-[var(--tawny)]' : RAIL[review]}`} aria-hidden />
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-semibold tabular-nums text-foreground">
                        {formatTime(new Date(e.clockInTime))} – {running ? '…' : formatTime(new Date(e.clockOutTime as string))}
                      </span>
                      <span className="text-lg font-bold tabular-nums text-foreground shrink-0">
                        {running ? t('hours.running') : formatWorkDuration(d)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <span className="text-sm text-muted-foreground">
                        {d.breakDeducted ? t('hours.breakDeducted') : ''}
                      </span>
                      {!running && (
                        <span className={`text-sm font-medium px-2 py-0.5 rounded-full shrink-0 ${PILL[review]}`}>
                          {t(`hours.status.${review}`)}
                        </span>
                      )}
                    </div>
                    {e.taskDescription && (
                      <p className="mt-2 text-base text-foreground whitespace-pre-wrap break-words">{e.taskDescription}</p>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {/* My performance sheet — month export, restored from the old Performance page */}
      <section className="mx-3 mt-6 p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t('hours.exportTitle')}</h2>
        <select
          value={exportMonth}
          onChange={e => setExportMonth(Number(e.target.value))}
          className="w-full h-12 px-3 rounded-xl border border-border bg-background text-base capitalize"
          aria-label={t('hours.exportMonth')}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>{formatMonthYear(subMonths(new Date(), i), lang)}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <a href={exportHref('xlsx')} className="h-12 rounded-xl border border-border flex items-center justify-center gap-2 text-base font-semibold">
            <FileSpreadsheet className="w-5 h-5 text-[var(--persian-green)]" />Excel
          </a>
          <a href={exportHref('pdf')} className="h-12 rounded-xl border border-border flex items-center justify-center gap-2 text-base font-semibold">
            <FileText className="w-5 h-5 text-[var(--tawny)]" />PDF
          </a>
        </div>
      </section>
    </div>
  );
}
