"use client";
/**
 * WH-2 · WorkHub — Time Off, built for the crew's phone.
 *
 * WorkHub-native: shares the DATA (useTimeOffRequests → /api/hr/time-off) with the back office,
 * never its components (coral-workhub-structure.md: "may share the CORE, not COMPONENTS").
 * The admin screen (time-tracker/pages/TimeOff.tsx) is untouched.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Plus, X, CalendarOff } from 'lucide-react';
import { useTimeOffRequests, type TimeOffRequest } from '@/components/time-tracker/hooks/useTimeOffRequests';
import { formatDayMonth, parseDateInput } from '@/lib/format/date';
import { describeError } from '@/lib/describe-error';

/** The values the server already stores — unchanged, so both surfaces keep reading the same data. */
const REQUEST_TYPES = [
  { value: 'Vacation', key: 'timeOff.vacation' },
  { value: 'Sick Leave', key: 'timeOff.sick' },
  { value: 'Personal', key: 'timeOff.personal' },
  { value: 'Other', key: 'timeOff.other' },
] as const;

/** Stored requestType → label key. Tolerates both shapes in production ('vacation' from the scheduler, 'Vacation' from the form). */
function typeKey(requestType: string): string {
  const t = (requestType || '').toLowerCase();
  if (t.startsWith('vac')) return 'timeOff.vacation';
  if (t.startsWith('sick')) return 'timeOff.sick';
  if (t.startsWith('pers')) return 'timeOff.personal';
  return 'timeOff.other';
}

type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';
function normStatus(s: string): Status {
  const v = (s || '').toLowerCase();
  if (v === 'approved' || v === 'rejected' || v === 'cancelled') return v;
  return 'pending';
}

const STATUS_STYLE: Record<Status, string> = {
  approved: 'bg-[var(--persian-green)]/10 text-[var(--persian-green)]',
  pending: 'bg-[var(--tawny)]/10 text-[var(--tawny)]',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-neutral-500/10 text-neutral-500',
};

const STATUS_RAIL: Record<Status, string> = {
  approved: 'bg-[var(--persian-green)]',
  pending: 'bg-[var(--tawny)]',
  rejected: 'bg-red-500',
  cancelled: 'bg-neutral-300 dark:bg-neutral-700',
};

/**
 * Display-only grouping: consecutive single days with the same type, status and note read as ONE
 * absence ("3 – 7 Aug · 5 days"). The records are untouched; each keeps its own id.
 */
interface Run { ids: string[]; first: TimeOffRequest; start: Date; end: Date; days: number; status: Status }

function dayOf(s: string): Date | null {
  const d = parseDateInput((s || '').slice(0, 10));
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
}
const ONE_DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / ONE_DAY);

function toRuns(requests: TimeOffRequest[]): Run[] {
  const rows = requests
    .map(r => ({ r, start: dayOf(r.startDate), end: dayOf(r.endDate) }))
    .filter((x): x is { r: TimeOffRequest; start: Date; end: Date } => !!x.start && !!x.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const runs: Run[] = [];
  for (const { r, start, end } of rows) {
    const status = normStatus(r.status);
    const last = runs[runs.length - 1];
    const sameKind = last
      && typeKey(last.first.requestType) === typeKey(r.requestType)
      && last.status === status
      && (last.first.notes || '') === (r.notes || '');
    if (sameKind && daysBetween(last.end, start) === 1) {
      last.ids.push(r.id);
      last.end = end;
      last.days += daysBetween(start, end) + 1;
    } else {
      runs.push({ ids: [r.id], first: r, start, end, days: daysBetween(start, end) + 1, status });
    }
  }
  // Newest first on screen.
  return runs.reverse();
}

export function TimeOffScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { requests, loading, error, createRequest, cancelRequest, refetch } = useTimeOffRequests();

  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<string>('Vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const runs = useMemo(() => toRuns(requests), [requests]);

  const range = (run: Run) => {
    const a = formatDayMonth(run.start, lang);
    const b = formatDayMonth(run.end, lang);
    const year = run.end.getFullYear() !== new Date().getFullYear() ? ` ${run.end.getFullYear()}` : '';
    return (run.days === 1 ? a : `${a} – ${b}`) + year;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      toast.error(t('timeOff.endBeforeStart'));
      return;
    }
    setSubmitting(true);
    const { error: err } = await createRequest({ requestType, startDate, endDate, notes: notes.trim() || undefined });
    setSubmitting(false);
    if (err) {
      console.error('[TimeOffScreen] create failed:', err);
      toast.error(`${t('timeOff.submitFailed')} — ${describeError(err)}`);
      return;
    }
    toast.success(t('timeOff.submitted'));
    setShowForm(false);
    setStartDate(''); setEndDate(''); setNotes(''); setRequestType('Vacation');
  };

  const cancelRun = async (run: Run) => {
    if (!window.confirm(t('timeOff.cancelConfirm'))) return;
    setCancelling(run.ids[0]);
    const results = await Promise.all(run.ids.map(id => cancelRequest(id)));
    setCancelling(null);
    const failed = results.find(r => r.error);
    if (failed?.error) {
      console.error('[TimeOffScreen] cancel failed:', failed.error);
      toast.error(`${t('timeOff.cancelFailed')} — ${describeError(failed.error)}`);
      refetch();
      return;
    }
    toast.success(t('timeOff.withdrawnToast'));
  };

  return (
    <div className="pb-6">
      {/* Title row — the shell already carries the app header; this is only the screen name + action */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-foreground">{t('timeOff.title')}</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-base font-semibold text-white bg-[var(--persian-green)] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            {t('timeOff.new')}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="mx-4 mb-4 p-4 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('timeOff.requestTimeOff')}</h2>
            <button type="button" onClick={() => setShowForm(false)} aria-label={t('common.close')} className="p-2 -mr-2 text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {REQUEST_TYPES.map(rt => (
              <button
                key={rt.value}
                type="button"
                onClick={() => setRequestType(rt.value)}
                className={`h-12 rounded-xl text-base font-medium border transition-colors ${
                  requestType === rt.value
                    ? 'border-[var(--persian-green)] bg-[var(--persian-green)]/10 text-[var(--persian-green)]'
                    : 'border-border text-foreground'
                }`}
              >
                {t(rt.key)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm text-muted-foreground mb-1">{t('timeOff.startDate')}</span>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => { setStartDate(e.target.value); if (!endDate || e.target.value > endDate) setEndDate(e.target.value); }}
                className="w-full h-12 px-3 rounded-xl border border-border bg-background text-base"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-muted-foreground mb-1">{t('timeOff.endDate')}</span>
              <input
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-border bg-background text-base"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm text-muted-foreground mb-1">{t('timeOff.notes')}</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !startDate || !endDate}
            className="w-full h-12 rounded-xl text-base font-semibold text-white bg-[var(--persian-green)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
            {t('timeOff.submit')}
          </button>
        </form>
      )}

      {error && (
        <div className="mx-4 mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          <p className="font-semibold">{t('timeOff.loadFailed')}</p>
          <p className="text-xs mt-0.5 break-words">{describeError(error)}</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-semibold underline">
            {t('timeOff.retry')}
          </button>
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div className="space-y-px animate-pulse">
          {[0, 1, 2].map(i => <div key={i} className="h-20 bg-muted/60" />)}
        </div>
      ) : !error && runs.length === 0 ? (
        <div className="flex flex-col items-center text-center px-8 py-16 text-muted-foreground">
          <CalendarOff className="w-12 h-12 mb-3" />
          <p className="text-base">{t('timeOff.empty')}</p>
        </div>
      ) : (
        <ul className="border-t border-border">
          {runs.map(run => (
            <li key={run.ids[0]} className="relative flex items-center gap-3 pl-5 pr-4 py-4 border-b border-border bg-background">
              <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${STATUS_RAIL[run.status]}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-base font-semibold ${run.status === 'cancelled' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {t(typeKey(run.first.requestType))}
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[run.status]}`}>
                    {t(`timeOff.${run.status}`)}
                  </span>
                </div>
                <p className="text-base text-muted-foreground mt-0.5">
                  {range(run)} · {t('timeOff.days', { count: run.days })}
                </p>
                {run.first.notes && (
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{run.first.notes}</p>
                )}
              </div>
              {/* 🟨 WH-2 decision (Planner): a worker may withdraw only a PENDING request. An approved absence is changed by HR. */}
              {run.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => cancelRun(run)}
                  disabled={cancelling === run.ids[0]}
                  className="shrink-0 h-10 px-3 rounded-full text-sm font-semibold border border-border text-foreground disabled:opacity-50"
                >
                  {cancelling === run.ids[0] ? <Loader2 className="w-4 h-4 animate-spin" /> : t('timeOff.withdraw')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
