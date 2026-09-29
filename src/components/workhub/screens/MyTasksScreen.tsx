"use client";
/**
 * WH-2 · WorkHub — My tasks. Replaces the full admin task manager the crew was shown.
 *
 * READ-ONLY by design (useTasks.ts architecture): management owns and closes a task; the crew
 * reports progress on the shift assignment (Shift Brief → tasks). This screen answers
 * "what is on my plate, by when, and what do I need to know".
 *
 * Data: /api/hr/erp-tasks (server-scoped to the caller's reach) — not the ERP database store,
 * so this screen does not need the full ERP dataset on the phone.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { CheckSquare, ChevronDown, FileText, Flag, FolderOpen, Paperclip, StickyNote, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FileViewer, { type ViewableFile } from '@/components/files/FileViewer';
import { hrList } from '@/lib/hr-api';
import { resolveFileUrl } from '@/lib/files';
import { describeError } from '@/lib/describe-error';
import { formatWeekdayDayMonth, parseDateInput } from '@/lib/format/date';

interface ErpTask {
  id: string;
  name: string;
  projectId: string | null;
  status: string;
  priority: string;
  assignedTo?: string[];
  properties: Record<string, unknown>;
}
interface Attachment { id: string; name: string; url: string; type: string }

type Stage = 'todo' | 'busy' | 'done';
/** Canonical ids are t-todo / t-prog / t-done (DatabaseClone); older rows and the endpoint default use opt-*. */
function stageOf(status: string): Stage {
  const s = (status || '').toLowerCase();
  if (s.includes('done')) return 'done';
  if (s.includes('prog') || s.includes('doing')) return 'busy';
  return 'todo';
}
const RAIL: Record<Stage, string> = {
  todo: 'bg-neutral-400 dark:bg-neutral-600',
  busy: 'bg-[var(--tawny)]',
  done: 'bg-[var(--persian-green)]',
};

function dueOf(t: ErpTask): Date | null {
  const raw = t.properties['prop-task-due'];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = parseDateInput(raw.slice(0, 10));
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
}

function attachmentsOf(t: ErpTask): Attachment[] {
  const raw = t.properties['prop-task-attachments'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is Attachment => !!a && typeof a === 'object' && typeof (a as Attachment).url === 'string' && !!(a as Attachment).url);
}

function isImage(name: string, type: string) {
  return (type || '').toLowerCase().startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(name);
}

export function MyTasksScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: session } = useSession();
  const me = session?.user?.id;
  const tenantId = session?.user?.tenantId || 'no-tenant';

  const tasksQ = useQuery({ queryKey: ['workhub-erp-tasks', tenantId], queryFn: () => hrList<ErpTask>('erp-tasks') });
  // Project names are a nicety — a failure here never hides a task.
  const projectsQ = useQuery({
    queryKey: ['workhub-erp-projects', tenantId],
    queryFn: () => hrList<{ id: string; name: string }>('erp-projects'),
  });

  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<ErpTask | null>(null);
  const [viewer, setViewer] = useState<{ files: ViewableFile[]; index: number } | null>(null);

  const projectName = useMemo(() => {
    const m = new Map((projectsQ.data || []).map(p => [p.id, p.name.replace(/^\[ERP\]\s*/i, '').trim()]));
    return (id: string | null) => (id ? m.get(id) || null : null);
  }, [projectsQ.data]);

  const today = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }, []);

  // The endpoint returns the caller's reach (a team lead sees the team's) — this screen is MY tasks.
  const mine = useMemo(
    () => (tasksQ.data || []).filter(task => !me || (task.assignedTo || []).includes(me)),
    [tasksQ.data, me],
  );
  const openTasks = useMemo(() => mine
    .filter(task => stageOf(task.status) !== 'done')
    .sort((a, b) => (dueOf(a)?.getTime() ?? Infinity) - (dueOf(b)?.getTime() ?? Infinity)), [mine]);
  const doneTasks = useMemo(() => mine.filter(task => stageOf(task.status) === 'done'), [mine]);

  const card = (task: ErpTask) => {
    const stage = stageOf(task.status);
    const due = dueOf(task);
    const overdue = !!due && stage !== 'done' && due < today;
    const urgent = task.priority === 'opt-p1' || task.priority === 'opt-p2';
    const project = projectName(task.projectId);
    const attachCount = attachmentsOf(task).length;
    return (
      <button
        key={task.id}
        type="button"
        onClick={() => setOpen(task)}
        className="relative w-full text-left overflow-hidden pl-5 pr-4 py-4 rounded-2xl border border-border bg-card shadow-sm active:scale-[0.99] transition"
      >
        <span className={`absolute left-0 top-0 bottom-0 w-2 ${RAIL[stage]}`} aria-hidden />
        <div className="flex items-start gap-2">
          <span className={`flex-1 min-w-0 text-lg font-semibold break-words ${stage === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.name}
          </span>
          {urgent && stage !== 'done' && (
            <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              <Flag className="w-4 h-4" />{t(task.priority === 'opt-p1' ? 'tasks.urgent' : 'tasks.high')}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted-foreground">
          {project && <span className="inline-flex items-center gap-1.5 min-w-0"><FolderOpen className="w-5 h-5 shrink-0" /><span className="truncate">{project}</span></span>}
          {due && (
            <span className={`inline-flex items-center gap-1.5 ${overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
              <Calendar className="w-5 h-5 shrink-0" />{formatWeekdayDayMonth(due, lang)}{overdue ? ` · ${t('tasks.overdue')}` : ''}
            </span>
          )}
          {attachCount > 0 && <span className="inline-flex items-center gap-1.5"><Paperclip className="w-5 h-5" />{attachCount}</span>}
        </div>
      </button>
    );
  };

  const openAttachments = open ? attachmentsOf(open) : [];
  const media: ViewableFile[] = openAttachments.map(a => ({ id: a.id, name: a.name, url: resolveFileUrl(a.url), type: a.type, mimeType: a.type }));
  const notes = open && typeof open.properties['prop-task-notes'] === 'string' ? (open.properties['prop-task-notes'] as string).trim() : '';

  return (
    <div className="pb-6">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-foreground">{t('tasks.title')}</h1>
      </div>

      {tasksQ.error && (
        <div className="mx-3 mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          <p className="font-semibold">{t('tasks.loadFailed')}</p>
          <p className="text-xs mt-0.5 break-words">{describeError(tasksQ.error)}</p>
          <button type="button" onClick={() => tasksQ.refetch()} className="mt-2 text-sm font-semibold underline">{t('timeOff.retry')}</button>
        </div>
      )}

      {tasksQ.isLoading ? (
        <div className="space-y-3 px-3 animate-pulse">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-muted/60" />)}
        </div>
      ) : !tasksQ.error && mine.length === 0 ? (
        <div className="flex flex-col items-center text-center px-8 py-16 text-muted-foreground">
          <CheckSquare className="w-12 h-12 mb-3" />
          <p className="text-base">{t('tasks.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3 px-3">
          {openTasks.map(card)}
          {doneTasks.length > 0 && (
            <>
              <button type="button" onClick={() => setShowDone(s => !s)}
                className="w-full flex items-center justify-center gap-2 h-12 text-base font-semibold text-muted-foreground">
                {t('tasks.done', { count: doneTasks.length })}
                <ChevronDown className={`w-5 h-5 transition-transform ${showDone ? 'rotate-180' : ''}`} />
              </button>
              {showDone && doneTasks.map(card)}
            </>
          )}
        </div>
      )}

      {/* Detail — the carousel steps outside the dialog (Radix content is transformed). */}
      <Dialog open={!!open && !viewer} onOpenChange={(o) => { if (!o && !viewer) setOpen(null); }}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden font-content">
          {open && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-neutral-100 dark:border-white/10 text-left">
                <DialogTitle className="text-lg font-semibold leading-snug break-words">{open.name}</DialogTitle>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-base text-muted-foreground">
                  {projectName(open.projectId) && <span className="inline-flex items-center gap-1.5"><FolderOpen className="w-5 h-5" />{projectName(open.projectId)}</span>}
                  {dueOf(open) && <span className="inline-flex items-center gap-1.5"><Calendar className="w-5 h-5" />{formatWeekdayDayMonth(dueOf(open) as Date, lang, true)}</span>}
                </div>
              </DialogHeader>
              <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
                {notes ? (
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><StickyNote className="w-4 h-4" />{t('schedule.notes')}</h3>
                    <p className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-base whitespace-pre-wrap break-words">{notes}</p>
                  </section>
                ) : null}
                {media.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Paperclip className="w-4 h-4" />{t('schedule.attachments')} · {media.length}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {media.map((m, i) => (
                        <button key={m.id} type="button" onClick={() => setViewer({ files: media, index: i })} aria-label={m.name}
                          className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-neutral-900">
                          {isImage(m.name, m.type || '') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex flex-col items-center justify-center w-full h-full p-2 gap-1">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                              <span className="text-xs w-full truncate text-center">{m.name}</span>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {!notes && media.length === 0 && (
                  <p className="text-base text-muted-foreground text-center py-4">{t('tasks.noDetails')}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {viewer && (
        <FileViewer files={viewer.files} index={viewer.index}
          onIndexChange={(index) => setViewer(v => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
