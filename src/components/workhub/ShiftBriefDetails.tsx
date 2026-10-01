"use client";
/**
 * WH-2 · the Shift Brief body — everything a crew member needs on site, in one place.
 * Florin 2026-09-30: address, contact phone, tasks, attachments, notes live in the MODAL, not on the cards.
 *
 * Each property renders by what it IS:
 *   address → opens the phone's map app      phone → dials      e-mail → opens mail
 *   notes   → plain text, wraps, never cut    tasks → worker progress (start / done / checklist)
 *   files   → thumbnails; tap opens the shared FileViewer carousel (swipe/arrows), not a new tab
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  MapPin, Phone, Mail, StickyNote, CheckSquare, Paperclip, ChevronRight,
  FileText, Loader2, Check, Circle, PlayCircle, Camera,
} from 'lucide-react';
import { uploadFileAction } from '@/app/actions/files';
import { addShiftFile } from '@/lib/data/shift-files';
import type { ViewableFile } from '@/components/files/FileViewer';
import { resolveFileUrl } from '@/lib/files';
import { describeError } from '@/lib/describe-error';
import { useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import type { ShiftBriefResult } from '@/lib/data/shift-brief';

const ROW = 'flex items-center gap-3 min-w-0 p-3.5 rounded-xl border border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-neutral-900/60';
const LINK_ROW = `${ROW} hover:bg-neutral-100 dark:hover:bg-neutral-900 active:scale-[0.99] transition`;
const SECTION_LABEL = 'flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground';

/** tel: wants digits and a leading +; spaces, dots, dashes and brackets are for humans. */
function telHref(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

function isImage(name: string, type: string): boolean {
  return type.toLowerCase().startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(name);
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toUpperCase() : '';
}

interface Props {
  shiftId: string;
  brief: ShiftBriefResult | null;
  /** Address known before the brief loads (from the shift list) — shown immediately. */
  fallbackAddress: string | null;
  title: string;
  userId?: string;
  /** The brief is still loading — every section shows a placeholder bar at its final height. */
  loading?: boolean;
  /** The carousel is rendered by the PARENT, outside the dialog: Radix's dialog content is
   *  transformed, which would trap a `fixed` full-screen viewer inside the modal's box. */
  onOpenMedia: (files: ViewableFile[], index: number) => void;
  /** WO-1 tabs: render one part only. Omitted → everything (the pre-tab layout). */
  section?: 'info' | 'tasks' | 'files';
  /** Files tab: the crew may add photos/documents (own, open shift). Called after a successful add. */
  onFilesAdded?: () => void;
  canAddFiles?: boolean;
}

export function ShiftBriefDetails({ shiftId, brief, fallbackAddress, title, userId, onOpenMedia, loading = false, section, onFilesAdded, canAddFiles = false }: Props) {
  const { t } = useTranslation();
  const show = (k: 'info' | 'tasks' | 'files') => !section || section === k;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    let added = 0;
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await uploadFileAction(fd, 'hr-shift', shiftId);
        if (!up?.success || !up.key) throw new Error(up?.error || 'upload failed');
        const res = await addShiftFile({ shiftId, key: up.key, name: file.name, type: file.type, size: file.size });
        if (!res.ok) throw new Error(res.error);
        added++;
      }
      toast.success(t('schedule.filesAdded', { count: added }));
    } catch (err) {
      console.error('[ShiftBrief] add file failed:', err);
      toast.error(`${t('schedule.fileAddFailed')} — ${describeError(err)}`);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
      if (added) onFilesAdded?.();
    }
  };
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const {
    shiftTasks, loading: tasksLoading, error: tasksError,
    startShiftTask, completeShiftTask, toggleSubTask,
  } = useShiftTasks(shiftId);

  const address = brief?.address || fallbackAddress;
  const mapUrl = brief?.mapUrl || (address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null);
  // Notes that merely repeat the title (the title's 3-step fallback can land on notes) are not repeated.
  const notes = brief?.notes && brief.notes !== title ? brief.notes : null;

  /** One list for the carousel: site files first, then photos taken at clock-out. */
  const media: ViewableFile[] = useMemo(() => {
    const files = (brief?.files || []).map(f => ({
      id: f.id, name: f.name, url: resolveFileUrl(f.url), type: f.type, mimeType: f.type,
    }));
    const photos = (brief?.photos || []).map((p, i) => ({
      id: `photo-${i}-${p.key}`, name: p.name, url: resolveFileUrl(p.key), type: p.type, mimeType: p.type,
    }));
    return [...files, ...photos].filter(m => m.url);
  }, [brief]);

  const runTask = async (id: string, fn: () => Promise<unknown>) => {
    setBusyTask(id);
    try {
      await fn();
    } catch (err) {
      console.error('[ShiftBrief] task update failed:', err);
      toast.error(`${t('schedule.taskUpdateFailed')} — ${describeError(err)}`);
    } finally {
      setBusyTask(null);
    }
  };

  return (
    <div className="space-y-4">
      {show('info') && (<>
      {/* ── Where and who — ALWAYS rendered (Florin: placeholders, not elements that pop in and vanish) ── */}
        <div className="space-y-2">
          {loading && !address ? <Skeleton /> : !address ? (
            <div className={`${ROW} text-muted-foreground`}><MapPin className="w-6 h-6 shrink-0 opacity-50" /><span className="text-base">{t('schedule.noAddress')}</span></div>
          ) : mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={LINK_ROW}>
              <MapPin className="w-6 h-6 text-[var(--persian-green)] shrink-0" />
              <span className="flex-1 min-w-0 text-base font-medium text-foreground break-words">{address}</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </a>
          )}
          {loading ? <Skeleton /> : !brief?.contactPhone && !brief?.contactEmail ? (
            <div className={`${ROW} text-muted-foreground`}><Phone className="w-6 h-6 shrink-0 opacity-50" /><span className="text-base">{t('schedule.noContact')}</span></div>
          ) : null}
          {!loading && brief?.contactPhone && (
            <a href={telHref(brief.contactPhone)} className={LINK_ROW}>
              <Phone className="w-6 h-6 text-[var(--persian-green)] shrink-0" />
              <span className="flex-1 min-w-0">
                {brief.contactName && <span className="block text-sm text-muted-foreground truncate">{brief.contactName}</span>}
                <span className="block text-base font-semibold text-foreground">{brief.contactPhone}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-[var(--persian-green)]">{t('schedule.call')}</span>
            </a>
          )}
          {!loading && brief?.contactEmail && (
            <a href={`mailto:${brief.contactEmail}`} className={LINK_ROW}>
              <Mail className="w-6 h-6 text-[var(--persian-green)] shrink-0" />
              <span className="flex-1 min-w-0 text-base font-medium text-foreground break-all">{brief.contactEmail}</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </a>
          )}
        </div>

      {/* ── Notes from the planner — always rendered ── */}
        <section className="space-y-2">
          <h3 className={SECTION_LABEL}><StickyNote className="w-4 h-4" />{t('schedule.notes')}</h3>
          {loading ? <Skeleton /> : notes ? (
            <p className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-base text-foreground whitespace-pre-wrap break-words">
              {notes}
            </p>
          ) : <p className="px-1 text-base text-muted-foreground">{t('schedule.noNotes')}</p>}
        </section>

      </>)}

      {show('tasks') && (<>
      {/* ── Tasks — the worker reports progress; management closes the task itself ── */}
        <section className="space-y-2">
          <h3 className={SECTION_LABEL}>
            <CheckSquare className="w-4 h-4" />{t('schedule.tasks')}
            {shiftTasks.length > 0 && (
              <span className="normal-case tracking-normal font-medium">
                · {shiftTasks.filter(st => st.status === 'done_by_worker').length}/{shiftTasks.length}
              </span>
            )}
          </h3>
          {tasksError && <p className="text-sm text-amber-700 dark:text-amber-300">{tasksError}</p>}
          {tasksLoading && shiftTasks.length === 0 ? (
            <Skeleton />
          ) : shiftTasks.length === 0 ? (
            <p className="px-1 text-base text-muted-foreground">{t('schedule.noTasks')}</p>
          ) : (
            <ul className="space-y-2">
              {shiftTasks.map(st => {
                const done = st.status === 'done_by_worker';
                const started = st.status === 'in_progress';
                const busy = busyTask === st.id;
                return (
                  <li key={st.id} className={`${ROW} flex-col items-stretch gap-2`}>
                    <div className="flex items-start gap-3 min-w-0">
                      {done
                        ? <Check className="w-6 h-6 text-[var(--persian-green)] shrink-0 mt-0.5" />
                        : started
                          ? <PlayCircle className="w-6 h-6 text-[var(--tawny)] shrink-0 mt-0.5" />
                          : <Circle className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />}
                      <span className={`flex-1 min-w-0 text-base font-medium break-words ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {st.task?.title || t('schedule.taskFallback')}
                      </span>
                    </div>

                    {st.subtasks?.length > 0 && (
                      <ul className="pl-9 space-y-1">
                        {st.subtasks.map(sub => (
                          <li key={sub.id}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runTask(st.id, () => toggleSubTask(st.id, sub.id, userId))}
                              className="flex items-center gap-2 w-full text-left py-1 text-base"
                            >
                              <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${sub.done ? 'bg-[var(--persian-green)] border-[var(--persian-green)]' : 'border-neutral-400'}`}>
                                {sub.done && <Check className="w-4 h-4 text-white" />}
                              </span>
                              <span className={`min-w-0 break-words ${sub.done ? 'line-through text-muted-foreground' : ''}`}>{sub.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {st.workerNotes && (
                      <p className="pl-9 text-sm text-muted-foreground whitespace-pre-wrap break-words">{st.workerNotes}</p>
                    )}

                    {!done && (
                      <div className="flex gap-2 pl-9">
                        {!started && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => runTask(st.id, () => startShiftTask(st.id))}
                            className="h-11 px-4 rounded-full border border-border text-base font-semibold disabled:opacity-50"
                          >
                            {t('schedule.startTask')}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => runTask(st.id, () => completeShiftTask(st.id, userId))}
                          className="h-11 px-4 rounded-full bg-[var(--persian-green)] text-white text-base font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                          {t('schedule.markDone')}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </>)}

      {show('files') && (<>
      {/* ── Attachments — always rendered; thumbnails open the carousel ── */}
        <section className="space-y-2">
          <h3 className={SECTION_LABEL}><Paperclip className="w-4 h-4" />{t('schedule.attachments')}{media.length > 0 ? ` · ${media.length}` : ''}</h3>
          {canAddFiles && (
            <>
              <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" className="hidden"
                onChange={e => addFiles(e.target.files)} />
              <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}
                className="w-full h-12 rounded-xl border-2 border-dashed border-[var(--persian-green)] text-[var(--persian-green)] text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {t('schedule.addFiles')}
              </button>
            </>
          )}
          {loading ? <Skeleton /> : media.length === 0 ? (
            <p className="px-1 text-base text-muted-foreground">{t('schedule.noAttachments')}</p>
          ) : (
          <div className="grid grid-cols-3 gap-2">
            {media.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenMedia(media, i)}
                className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-neutral-900 active:scale-[0.98] transition"
                aria-label={m.name}
              >
                {isImage(m.name, m.type || '') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center justify-center w-full h-full p-2 gap-1">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    {extOf(m.name) && <span className="text-xs font-bold text-muted-foreground">{extOf(m.name)}</span>}
                    <span className="text-xs text-foreground w-full truncate text-center">{m.name}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
          )}
        </section>
      </>)}
    </div>
  );
}

/** A placeholder at the final height of a row — the modal never jumps while the brief loads. */
function Skeleton() {
  return <div className="h-[3.25rem] rounded-xl bg-muted/60 animate-pulse" aria-hidden />;
}
