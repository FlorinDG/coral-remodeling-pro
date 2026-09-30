"use client";
/**
 * TASK-CREW-1 · the task's working record in the WorkHub.
 *   status  — assignees (and HR roles) move it To do / Busy / Done
 *   notes   — details + photos; a draft is editable by its author, SUBMIT freezes it
 *   log     — every status change and note submission, read-only for everyone
 * Server: lib/data/task-crew.ts (every change audited in the same transaction).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Camera, Send, Trash2, History, StickyNote, Circle, PlayCircle, CheckCircle2 } from 'lucide-react';
import type { ViewableFile } from '@/components/files/FileViewer';
import {
  getTaskRecord, setTaskStage, saveTaskNoteDraft, submitTaskNote, deleteTaskNoteDraft,
  type TaskStage, type TaskNoteView, type TaskActivityEntry,
} from '@/lib/data/task-crew';
import { uploadFileAction } from '@/app/actions/files';
import { resolveFileUrl, type StoredPhoto } from '@/lib/files';
import { describeError } from '@/lib/describe-error';
import { formatTime, formatWeekdayDayMonth } from '@/lib/format/date';

const STAGES: { stage: TaskStage; key: string; icon: typeof Circle; on: string }[] = [
  { stage: 'todo', key: 'tasks.stage.todo', icon: Circle, on: 'border-neutral-500 bg-neutral-500/10 text-foreground' },
  { stage: 'busy', key: 'tasks.stage.busy', icon: PlayCircle, on: 'border-[var(--tawny)] bg-[var(--tawny)]/10 text-[var(--tawny)]' },
  { stage: 'done', key: 'tasks.stage.done', icon: CheckCircle2, on: 'border-[var(--persian-green)] bg-[var(--persian-green)]/10 text-[var(--persian-green)]' },
];

interface Props {
  taskId: string;
  onOpenMedia: (files: ViewableFile[], index: number) => void;
  onStageChanged?: (stage: TaskStage) => void;
}

export function TaskRecordPanel({ taskId, onOpenMedia, onStageChanged }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<TaskStage>('todo');
  const [canAct, setCanAct] = useState(false);
  const [notes, setNotes] = useState<TaskNoteView[]>([]);
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [draftId, setDraftId] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getTaskRecord(taskId);
    setLoading(false);
    if (!res.ok) { setError(t(`tasks.error.${res.error}`)); return; }
    setError(null);
    setStage(res.stage);
    setCanAct(res.canAct);
    setNotes(res.notes);
    setActivity(res.activity);
    const draft = res.notes.find(n => n.mine && n.status === 'draft');
    setDraftId(draft?.id);
    setText(draft?.text || '');
    setPhotos(draft?.photos || []);
  }, [taskId, t]);

  useEffect(() => { load(); }, [load]);

  const fail = (res: { error: string; detail?: string }) =>
    toast.error(`${t(`tasks.error.${res.error}`)}${res.detail ? ` — ${res.detail}` : ''}`);

  const changeStage = async (next: TaskStage) => {
    if (next === stage) return;
    setBusy('stage');
    const res = await setTaskStage(taskId, next);
    setBusy(null);
    if (!res.ok) return fail(res);
    setStage(next);
    onStageChanged?.(next);
    load();
  };

  const saveDraft = async (nextPhotos = photos) => {
    const res = await saveTaskNoteDraft({ taskId, noteId: draftId, text, photos: nextPhotos });
    if (!res.ok) { fail(res); return null; }
    setDraftId(res.noteId);
    return res.noteId;
  };

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy('photos');
    try {
      const added: StoredPhoto[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const up = await uploadFileAction(fd, 'task-notes', taskId);
        if (!up.success || !up.key) throw new Error(up.error || 'upload failed');
        added.push({ key: up.key, name: f.name, type: f.type || 'image/jpeg' });
      }
      const next = [...photos, ...added];
      setPhotos(next);
      await saveDraft(next);
    } catch (err) {
      console.error('[TaskRecordPanel] photo upload failed:', err);
      toast.error(`${t('tasks.photoFailed')} — ${describeError(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!text.trim() && photos.length === 0) return;
    if (!window.confirm(t('tasks.submitNoteConfirm'))) return;
    setBusy('submit');
    const id = await saveDraft();
    if (id) {
      const res = await submitTaskNote(id);
      if (!res.ok) fail(res);
      else { toast.success(t('tasks.noteSubmitted')); await load(); }
    }
    setBusy(null);
  };

  const discard = async () => {
    if (!draftId) { setText(''); setPhotos([]); return; }
    setBusy('discard');
    const res = await deleteTaskNoteDraft(draftId);
    setBusy(null);
    if (!res.ok) return fail(res);
    await load();
  };

  const media = (list: StoredPhoto[]): ViewableFile[] =>
    list.map((p, i) => ({ id: `${p.key}-${i}`, name: p.name, url: resolveFileUrl(p.key), type: p.type, mimeType: p.type }));

  const when = (iso: string) => `${formatWeekdayDayMonth(new Date(iso), lang)} ${formatTime(new Date(iso))}`;

  const describe = (e: TaskActivityEntry) => {
    if (e.action === 'status') {
      const s = String((e.after as { status?: string } | null)?.status || '');
      const st: TaskStage = s.includes('done') ? 'done' : s.includes('prog') ? 'busy' : 'todo';
      return t('tasks.log.status', { stage: t(`tasks.stage.${st}`) });
    }
    if (e.action === 'note_submit') return t('tasks.log.note');
    return e.action;
  };

  if (loading) return <div className="h-24 rounded-xl bg-muted/60 animate-pulse" />;
  if (error) return <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>;

  const submitted = notes.filter(n => n.status === 'submitted');

  return (
    <div className="space-y-5">
      {/* Status */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('tasks.status')}</h3>
        <div className="grid grid-cols-3 gap-2">
          {STAGES.map(({ stage: s, key, icon: Icon, on }) => (
            <button
              key={s}
              type="button"
              disabled={!canAct || busy === 'stage'}
              onClick={() => changeStage(s)}
              className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold transition disabled:opacity-60 ${
                stage === s ? on : 'border-border text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />{t(key)}
            </button>
          ))}
        </div>
      </section>

      {/* Submitted notes — the record */}
      {submitted.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <StickyNote className="w-4 h-4" />{t('tasks.notes')}
          </h3>
          {submitted.map(n => (
            <div key={n.id} className="p-3.5 rounded-xl border border-border bg-card space-y-2">
              <p className="text-sm text-muted-foreground">
                {n.authorName || '—'} · {n.submittedAt ? when(n.submittedAt) : ''} · 🔒
              </p>
              {n.text && <p className="text-base whitespace-pre-wrap break-words">{n.text}</p>}
              {n.photos.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {n.photos.map((p, i) => (
                    <button key={i} type="button" onClick={() => onOpenMedia(media(n.photos), i)}
                      className="aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveFileUrl(p.key)} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* My draft */}
      {canAct && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('tasks.myNote')}</h3>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => { if (text.trim() || photos.length) saveDraft(); }}
            rows={3}
            placeholder={t('tasks.notePlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base"
          />
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {photos.map((p, i) => (
                <button key={i} type="button" onClick={() => onOpenMedia(media(photos), i)}
                  className="aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveFileUrl(p.key)} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addPhotos} />
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
              className="h-12 px-4 rounded-xl border border-border inline-flex items-center gap-2 text-base font-semibold disabled:opacity-50">
              {busy === 'photos' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}{t('tasks.addPhoto')}
            </button>
            <button type="button" onClick={submit} disabled={!!busy || (!text.trim() && photos.length === 0)}
              className="flex-1 h-12 rounded-xl bg-[var(--persian-green)] text-white inline-flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-50">
              {busy === 'submit' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}{t('tasks.submitNote')}
            </button>
            {(draftId || text || photos.length > 0) && (
              <button type="button" onClick={discard} disabled={!!busy} aria-label={t('tasks.discard')}
                className="h-12 w-12 rounded-xl border border-border inline-flex items-center justify-center disabled:opacity-50">
                <Trash2 className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('tasks.submitHint')}</p>
        </section>
      )}

      {/* The change log — read-only for every role */}
      {activity.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="w-4 h-4" />{t('tasks.log.title')}
          </h3>
          <ol className="space-y-1.5">
            {[...activity].reverse().map(e => (
              <li key={e.id} className="text-sm">
                <span className="text-muted-foreground">{when(e.at)} · </span>
                <span className="font-medium">{e.actorLabel}</span>
                <span> — {describe(e)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
