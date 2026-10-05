"use client";
/**
 * WO-1 · opening a shift opens the WORK ORDER — one tab row inside it (Florin 2026-10-01:
 * "everything is a work order"). Plan: .agents/workflows/coral-work-order-tabs.md
 *
 *   Info   — where, who, the planner's instructions
 *   Hours  — every entry on this shift + add hours (the late-entry form, bound to this shift:
 *            the shift stays open until the worker submits it)
 *   Tasks  — worker progress
 *   Files  — the crew's note + photos/documents
 *   Sign   — the client's signature (WO-3; shown, not yet active)
 * Materials (MAT-1) and custom forms (FORM-1) come later.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Info, Clock, CheckSquare, Paperclip, PenLine, Loader2 } from 'lucide-react';
import { ShiftBriefDetails } from '@/components/workhub/ShiftBriefDetails';
import { LateEntryCard } from '@/components/time-tracker/components/LateEntryCard';
import type { ViewableFile } from '@/components/files/FileViewer';
import type { ShiftBriefResult } from '@/lib/data/shift-brief';
import { saveCrewNote } from '@/lib/data/shift-files';
import { getWorkOrderSummary, signWorkOrder, type WorkOrderSummary } from '@/lib/data/work-order';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { formatTime } from '@/lib/format/date';
import { describeError } from '@/lib/describe-error';

type Tab = 'info' | 'hours' | 'tasks' | 'files' | 'sign';

interface Props {
  shiftId: string;
  shiftDate: string;
  submitted: boolean;
  brief: ShiftBriefResult | null;
  briefLoading: boolean;
  fallbackAddress: string | null;
  title: string;
  userId?: string;
  onOpenMedia: (files: ViewableFile[], index: number) => void;
  /** Something on the work order changed — reload the brief (and the shift list). */
  onChanged: () => void;
}

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export function WorkOrderTabs(p: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('info');
  const tabs: Array<{ id: Tab; icon: typeof Info; label: string }> = [
    { id: 'info', icon: Info, label: t('workOrder.tabInfo') },
    { id: 'hours', icon: Clock, label: t('workOrder.tabHours') },
    { id: 'tasks', icon: CheckSquare, label: t('workOrder.tabTasks') },
    { id: 'files', icon: Paperclip, label: t('workOrder.tabFiles') },
    { id: 'sign', icon: PenLine, label: t('workOrder.tabSign') },
  ];

  // A signed work order is closed like a submitted shift — more strictly: for every role.
  const closed = p.submitted || !!p.brief?.signed;
  const common = {
    shiftId: p.shiftId, brief: p.brief, fallbackAddress: p.fallbackAddress, title: p.title,
    userId: p.userId, onOpenMedia: p.onOpenMedia, loading: p.briefLoading && !p.brief,
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div role="tablist" className="grid grid-cols-5 shrink-0 border-b border-neutral-100 dark:border-white/10">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${tab === id
              ? 'text-[var(--persian-green)] border-b-2 border-[var(--persian-green)]'
              : 'text-muted-foreground border-b-2 border-transparent'}`}>
            <Icon className="w-5 h-5" />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 p-4 space-y-3 overflow-y-auto overscroll-contain">
        {tab === 'info' && <ShiftBriefDetails {...common} section="info" />}
        {tab === 'tasks' && <ShiftBriefDetails {...common} section="tasks" />}
        {tab === 'hours' && (
          <div className="space-y-3">
            {p.briefLoading && !p.brief ? (
              <div className="h-[3.25rem] rounded-xl bg-muted/60 animate-pulse" aria-hidden />
            ) : !p.brief?.entries.length ? (
              <p className="px-1 text-base text-muted-foreground">{t('workOrder.noHours')}</p>
            ) : (
              <ul className="space-y-2">
                {p.brief.entries.map(e => (
                  <li key={e.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-neutral-900/60">
                    <span className="text-base font-semibold tabular-nums">
                      {formatTime(new Date(e.in), i18n.language)} – {e.out ? formatTime(new Date(e.out), i18n.language) : '…'}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {e.out ? hm(e.minutes) : t('workOrder.running')}
                      {e.approvalStatus === 'pending' ? ` · ${t('workOrder.pending')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!closed && (
              <LateEntryCard shiftId={p.shiftId} shiftDate={p.shiftDate} onSubmitted={p.onChanged} />
            )}
          </div>
        )}
        {tab === 'files' && (
          <div className="space-y-4">
            <CrewNote shiftId={p.shiftId} initial={p.brief?.crewNote ?? ''} disabled={closed} loading={p.briefLoading && !p.brief} />
            <ShiftBriefDetails {...common} section="files" canAddFiles={!closed} onFilesAdded={p.onChanged} />
          </div>
        )}
        {tab === 'sign' && <SignTab shiftId={p.shiftId} onSigned={p.onChanged} />}
      </div>
    </div>
  );
}

function CrewNote({ shiftId, initial, disabled, loading }: { shiftId: string; initial: string; disabled: boolean; loading: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(initial); setSaved(initial); }, [initial]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveCrewNote(shiftId, text);
      if (!res.ok) throw new Error(res.error);
      setSaved(text);
      toast.success(t('workOrder.noteSaved'));
    } catch (err) {
      toast.error(`${t('workOrder.noteFailed')} — ${describeError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-28 rounded-xl bg-muted/60 animate-pulse" aria-hidden />;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('workOrder.myNote')}</h3>
      <p className="text-sm text-muted-foreground">{t('workOrder.myNoteHint')}</p>
      <textarea value={text} onChange={e => setText(e.target.value)} disabled={disabled || busy} rows={4}
        placeholder={t('workOrder.notePlaceholder')}
        className="w-full p-3 rounded-xl border border-border bg-background text-base resize-y disabled:opacity-60" />
      {!disabled && text !== saved && (
        <button type="button" onClick={save} disabled={busy}
          className="w-full h-12 rounded-xl bg-[var(--persian-green)] text-white text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-5 h-5 animate-spin" />}{t('workOrder.saveNote')}
        </button>
      )}
    </section>
  );
}

/** WO-3 · the client signs the work order on this phone — the whole visit, every crew member on it. */
function SignTab({ shiftId, onSigned }: { shiftId: string; onSigned: () => void }) {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<WorkOrderSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [png, setPng] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    getWorkOrderSummary(shiftId).then(r => {
      if (!live) return;
      if (r.ok) { setSummary(r.summary); setLoadError(null); } else setLoadError(r.error);
    }).catch(err => live && setLoadError(describeError(err)));
    return () => { live = false; };
  }, [shiftId, version]);

  const sign = async () => {
    if (!png || name.trim().length < 2) return;
    if (!window.confirm(t('workOrder.signConfirm'))) return;
    setBusy(true);
    try {
      const r = await signWorkOrder({ shiftId, signerName: name, signaturePng: png });
      if (!r.ok) throw new Error(t(`workOrder.signError.${r.error}`, { defaultValue: r.detail ? `${r.error} — ${r.detail}` : r.error }));
      toast.success(t('workOrder.signedToast'));
      setVersion(v => v + 1);
      onSigned();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p className="text-sm text-amber-700 dark:text-amber-300">{t('workOrder.signLoadFailed')} — {loadError}</p>;
  if (!summary) return <div className="h-40 rounded-xl bg-muted/60 animate-pulse" aria-hidden />;

  const lines = (
    <ul className="space-y-1.5">
      {summary.members.map(m => (
        <li key={m.shiftId} className="flex justify-between gap-3 text-base">
          <span className="font-medium truncate">{m.workerName || '—'}</span>
          <span className="tabular-nums text-muted-foreground shrink-0">
            {m.entries.length
              ? m.entries.map(e => `${formatTime(new Date(e.in), i18n.language)}–${e.out ? formatTime(new Date(e.out), i18n.language) : '…'}`).join(', ')
              : t('workOrder.noHoursShort')}
          </span>
        </li>
      ))}
      <li className="flex justify-between pt-1.5 border-t border-border text-base font-semibold">
        <span>{t('workOrder.total')}</span><span className="tabular-nums">{hm(summary.totalMinutes)}</span>
      </li>
    </ul>
  );

  if (summary.signed) {
    return (
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-1">
          <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">✓ {t('workOrder.signedBy', { name: summary.signed.signerName })}</p>
          <p className="text-sm text-muted-foreground">{summary.signed.number ? `${summary.signed.number} · ` : ''}{new Date(summary.signed.signedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short', hour12: false })}</p>
        </div>
        {lines}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('workOrder.signIntro')}</p>
      {lines}
      {summary.openEntries > 0 ? (
        <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm">{t('workOrder.signError.still_clocked_in')}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label htmlFor="signer" className="text-sm font-semibold">{t('workOrder.signerName')}</label>
            <input id="signer" value={name} onChange={e => setName(e.target.value)} autoComplete="name"
              className="w-full h-12 px-3 rounded-xl border border-border bg-background text-base" />
          </div>
          <SignaturePad large onSign={setPng} onClear={() => setPng(null)}
            label={t('workOrder.signHere')} clearLabel={t('workOrder.clear')} hint={t('workOrder.signHint')} />
          <button type="button" onClick={sign} disabled={busy || !png || name.trim().length < 2}
            className="w-full h-14 rounded-xl bg-[var(--persian-green)] text-white text-base font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40">
            {busy && <Loader2 className="w-5 h-5 animate-spin" />}{t('workOrder.signButton')}
          </button>
        </>
      )}
    </div>
  );
}
