'use client';
/**
 * COMMENTS-1 · the thread on a record (side panel). Post, @mention (notifies), resolve / reopen, edit or delete your
 * own. Rules on the server (lib/records/comments.ts); this renders and asks. Mentions are stored as
 * `@[Name](userId)` and shown as **@Name**. `compact`: the same thread in the grid cell's flyout (Florin 2026-10-06:
 * "on click open a flyout with the comments thread. not a big window") — the list scrolls, the composer has focus.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MessageSquare, Check, RotateCcw, Pencil, Trash2, Send, Loader2 } from 'lucide-react';
import { getComments, postComment, editComment, deleteComment, resolveComment, getMentionableUsers } from '@/app/actions/comments';
import type { CommentView } from '@/lib/data/comments';
import { useLatestComments } from './latest-comments-store';
import { zonedParts } from '@/lib/kernel/shift-time';

const MENTION = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,64})\)/g;

function renderBody(body: string) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const m of body.matchAll(MENTION)) {
        if (m.index! > last) parts.push(body.slice(last, m.index));
        parts.push(<b key={m.index} className="text-orange-600 dark:text-orange-400">@{m[1]}</b>);
        last = m.index! + m[0].length;
    }
    if (last < body.length) parts.push(body.slice(last));
    return parts;
}

function when(iso: string): string {
    const p = zonedParts(iso);
    return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)} ${p.time}`;
}

/** A textarea with an @-picker: typing "@" + letters offers the office's people; picking inserts @[Name](id). */
function Composer({ value, onChange, onSubmit, busy, placeholder, submitLabel, users, autoFocus }: {
    value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; placeholder: string; submitLabel: string;
    users: Array<{ id: string; name: string }>; autoFocus?: boolean;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [query, setQuery] = useState<string | null>(null);
    const matches = useMemo(() => query === null ? [] : users.filter(u => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6), [query, users]);

    const onInput = (v: string) => {
        onChange(v);
        const caret = ref.current?.selectionStart ?? v.length;
        const m = /(?:^|\s)@([^\s@\[\]]{0,30})$/.exec(v.slice(0, caret));
        setQuery(m ? m[1] : null);
    };
    const pick = (u: { id: string; name: string }) => {
        const el = ref.current; if (!el) return;
        const caret = el.selectionStart ?? value.length;
        const before = value.slice(0, caret).replace(/@([^\s@\[\]]{0,30})$/, `@[${u.name}](${u.id}) `);
        onChange(before + value.slice(caret));
        setQuery(null);
        requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; });
    };

    return (
        <div className="relative">
            <textarea
                ref={ref}
                autoFocus={autoFocus}
                value={value}
                onChange={e => onInput(e.target.value)}
                onKeyDown={e => {
                    if (matches.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pick(matches[0]); return; }
                    if (e.key === 'Escape' && query !== null) { setQuery(null); e.stopPropagation(); }   // closes the picker, not the flyout
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(); }
                }}
                rows={3}
                placeholder={placeholder}
                className="w-full text-sm rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 outline-none focus:border-orange-400 resize-y"
            />
            {matches.length > 0 && (
                <div className="absolute left-2 bottom-full mb-1 z-10 w-56 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-lg py-1">
                    {matches.map(u => (
                        <button key={u.id} type="button" onMouseDown={e => { e.preventDefault(); pick(u); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-white/5">@{u.name}</button>
                    ))}
                </div>
            )}
            <div className="flex justify-end mt-1.5">
                <button type="button" onClick={onSubmit} disabled={busy || !value.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--brand-color,#d35400)] disabled:opacity-50">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {submitLabel}
                </button>
            </div>
        </div>
    );
}

export default function CommentThread({ pageId, databaseId, compact = false }: { pageId: string; databaseId: string; compact?: boolean }) {
    const t = useTranslations('Admin.comments');
    const [comments, setComments] = useState<CommentView[] | null>(null);
    const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
    const refreshLatest = useLatestComments(s => s.load);

    const reload = useCallback(async () => {
        const r = await getComments(pageId);
        setComments(r.ok ? r.comments : []);
        refreshLatest(databaseId, true);   // the "Opmerkingen" field follows
    }, [pageId, databaseId, refreshLatest]);

    useEffect(() => {
        let alive = true;
        getComments(pageId).then(r => { if (alive) setComments(r.ok ? r.comments : []); });
        getMentionableUsers().then(u => { if (alive) setUsers(u); });
        return () => { alive = false; };
    }, [pageId]);

    const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
        setBusy(true);
        try {
            const r = await fn();
            if (!r.ok) { toast.error(`${t('failed')} — ${r.error}`); return false; }
            await reload();
            return true;
        } finally { setBusy(false); }
    };

    return (
        <section className={compact ? '' : 'mt-6 pt-4 border-t border-neutral-200 dark:border-white/10'} id={compact ? undefined : 'record-comments'}>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                <MessageSquare className="w-3.5 h-3.5" /> {t('title')}{comments?.length ? ` · ${comments.length}` : ''}
            </h3>
            {comments === null ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            ) : comments.length === 0 ? (
                <p className="text-xs text-neutral-400 mb-3">{t('empty')}</p>
            ) : (
                <ul className={`space-y-3 mb-4 ${compact ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                    {comments.map(c => (
                        <li key={c.id} className={`rounded-lg p-3 border ${c.resolvedAt ? 'border-neutral-100 dark:border-white/5 opacity-60' : 'border-neutral-200 dark:border-white/10'}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{c.authorName}</span>
                                <span className="text-[10px] text-neutral-400">
                                    {when(c.createdAt)}{c.editedAt ? ` · ${t('edited')}` : ''}{c.resolvedAt ? ` · ✓ ${t('resolved')}` : ''}
                                </span>
                            </div>
                            {editing?.id === c.id ? (
                                <div className="space-y-1">
                                    <Composer value={editing.body} onChange={v => setEditing({ id: c.id, body: v })} busy={busy} users={users}
                                              placeholder={t('placeholder')} submitLabel={t('save')}
                                              onSubmit={async () => { if (await run(() => editComment(c.id, editing.body))) setEditing(null); }} />
                                    <button type="button" onClick={() => setEditing(null)} className="text-[11px] text-neutral-500 hover:underline">{t('cancel')}</button>
                                </div>
                            ) : (
                                <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words">{renderBody(c.body)}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-500">
                                <button type="button" disabled={busy} onClick={() => run(() => resolveComment(c.id, !c.resolvedAt))} className="inline-flex items-center gap-1 hover:text-emerald-600">
                                    {c.resolvedAt ? <><RotateCcw className="w-3 h-3" /> {t('reopen')}</> : <><Check className="w-3 h-3" /> {t('resolve')}</>}
                                </button>
                                {c.mine && editing?.id !== c.id && (
                                    <button type="button" onClick={() => setEditing({ id: c.id, body: c.body })} className="inline-flex items-center gap-1 hover:text-neutral-800 dark:hover:text-neutral-200"><Pencil className="w-3 h-3" /> {t('edit')}</button>
                                )}
                                {c.mine && (
                                    <button type="button" disabled={busy} onClick={() => { if (window.confirm(t('deleteConfirm'))) run(() => deleteComment(c.id)); }} className="inline-flex items-center gap-1 hover:text-red-600"><Trash2 className="w-3 h-3" /> {t('delete')}</button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Composer value={draft} onChange={setDraft} busy={busy} users={users} placeholder={t('placeholder')} submitLabel={t('send')} autoFocus={compact}
                      onSubmit={async () => { if (await run(() => postComment(pageId, draft))) setDraft(''); }} />
        </section>
    );
}
