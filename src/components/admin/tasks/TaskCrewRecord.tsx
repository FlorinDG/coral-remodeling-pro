"use client";
/**
 * TASK-CREW-1 · the crew's notes and the change log, READ-ONLY, inside the ERP task panel.
 * Florin 2026-09-30: "the app keeps a detailed, read-only for all roles, log of changes."
 * Same source as the WorkHub (lib/data/task-crew.ts → getTaskRecord). Nothing here writes.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, StickyNote } from 'lucide-react';
import FileViewer, { type ViewableFile } from '@/components/files/FileViewer';
import { getTaskRecord, type TaskNoteView, type TaskActivityEntry } from '@/lib/data/task-crew';
import { resolveFileUrl } from '@/lib/files';
import { formatDateTime } from '@/lib/format/date';

export function TaskCrewRecord({ taskId }: { taskId: string }) {
    const t = useTranslations('Tasks.crewRecord');
    const [notes, setNotes] = useState<TaskNoteView[]>([]);
    const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ files: ViewableFile[]; index: number } | null>(null);

    useEffect(() => {
        let alive = true;
        getTaskRecord(taskId).then(res => {
            if (!alive) return;
            if (!res.ok) { setError(res.error); return; }
            setNotes(res.notes.filter(n => n.status === 'submitted'));
            setActivity(res.activity);
        }).catch(err => {
            console.error('[TaskCrewRecord] load failed:', err);
            if (alive) setError(err instanceof Error ? err.message : String(err));
        });
        return () => { alive = false; };
    }, [taskId]);

    if (error && error !== 'not_found') return <p className="text-xs text-amber-700">{t('loadFailed')} — {error}</p>;
    if (!notes.length && !activity.length) return null;

    const describe = (e: TaskActivityEntry) => {
        if (e.action === 'status') {
            const s = String((e.after as { status?: string } | null)?.status || '');
            return t('status', { stage: s.includes('done') ? t('stageDone') : s.includes('prog') ? t('stageBusy') : t('stageTodo') });
        }
        if (e.action === 'note_submit') return t('noteSubmitted');
        return e.action;
    };

    return (
        <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-white/10">
            {notes.length > 0 && (
                <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500"><StickyNote className="w-3.5 h-3.5" />{t('notes')}</p>
                    {notes.map(n => {
                        const files: ViewableFile[] = n.photos.map((p, i) => ({ id: `${p.key}-${i}`, name: p.name, url: resolveFileUrl(p.key), type: p.type, mimeType: p.type }));
                        return (
                            <div key={n.id} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 space-y-1.5">
                                <p className="text-[11px] text-neutral-500">{n.authorName || '—'} · {n.submittedAt ? formatDateTime(n.submittedAt) : ''} · 🔒</p>
                                {n.text && <p className="text-sm whitespace-pre-wrap break-words">{n.text}</p>}
                                {files.length > 0 && (
                                    <div className="grid grid-cols-5 gap-1">
                                        {files.map((f, i) => (
                                            <button key={f.id} type="button" onClick={() => setViewer({ files, index: i })} className="aspect-square rounded overflow-hidden bg-neutral-200">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={f.url} alt={f.name} loading="lazy" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {activity.length > 0 && (
                <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500"><History className="w-3.5 h-3.5" />{t('history')}</p>
                    <ol className="space-y-0.5">
                        {[...activity].reverse().map(e => (
                            <li key={e.id} className="text-xs text-neutral-700 dark:text-neutral-300">
                                <span className="text-neutral-500">{formatDateTime(e.at)} · </span>
                                <span className="font-semibold">{e.actorLabel}</span> — {describe(e)}
                            </li>
                        ))}
                    </ol>
                    <p className="text-[11px] text-neutral-400">{t('readOnly')}</p>
                </div>
            )}
            {viewer && (
                <FileViewer files={viewer.files} index={viewer.index}
                    onIndexChange={(index) => setViewer(v => (v ? { ...v, index } : v))}
                    onClose={() => setViewer(null)} />
            )}
        </div>
    );
}
