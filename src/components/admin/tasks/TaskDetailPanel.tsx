'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, ChevronDown } from 'lucide-react';
import { Page } from '@/components/admin/database/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './TaskRow';
import { parseRecurrenceRule } from './RecurrenceEngine';
import { todayStr } from './hooks/useTaskFilter';

interface TaskDetailPanelProps {
    page: Page;
    onClose: () => void;
    onUpdate: (pageId: string, props: Partial<Record<string, unknown>>) => void;
    onDelete: (pageId: string) => void;
    onOpenFullPage?: (pageId: string) => void;
}

const statusOptions = Object.entries(STATUS_CONFIG).map(([id, cfg]) => ({ id, ...cfg }));
const priorityOptions = [
    { id: 'opt-p1', label: 'P1 — Urgent', color: '#ef4444' },
    { id: 'opt-p2', label: 'P2 — High',   color: '#f97316' },
    { id: 'opt-p3', label: 'P3 — Medium', color: '#eab308' },
    { id: 'opt-p4', label: 'P4 — Low',    color: '#9ca3af' },
];

function Select({ value, options, onChange }: {
    value: string;
    options: { id: string; label?: string; icon?: string; color?: string }[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find(o => o.id === value);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/10 text-sm hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                style={{ color: current?.color }}
            >
                {current?.icon && <span>{current.icon}</span>}
                {current?.label || value}
                <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
            {open && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl py-1 min-w-[160px]">
                    {options.map(o => (
                        <button
                            key={o.id}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                            style={{ color: o.color }}
                            onClick={() => { onChange(o.id); setOpen(false); }}
                        >
                            {o.icon && <span>{o.icon}</span>}
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2 border-b border-neutral-100 dark:border-white/5 last:border-0">
            <span className="w-28 flex-shrink-0 text-xs text-neutral-500 dark:text-neutral-400 pt-1.5">{label}</span>
            <div className="flex-1">{children}</div>
        </div>
    );
}

export function TaskDetailPanel({ page, onClose, onUpdate, onDelete, onOpenFullPage }: TaskDetailPanelProps) {
    const props = page.properties;
    const [title, setTitle]   = useState((props['title'] as string) || '');
    const [notes, setNotes]   = useState((props['prop-task-notes'] as string) || '');
    const [dirty, setDirty]   = useState(false);

    // Sync when page changes
    useEffect(() => {
        setTitle((page.properties['title'] as string) || '');
        setNotes((page.properties['prop-task-notes'] as string) || '');
        setDirty(false);
    }, [page.id]);

    const update = (key: string, value: unknown) => {
        onUpdate(page.id, { [key]: value });
    };

    const saveTitle = () => {
        if (dirty) { update('title', title); setDirty(false); }
    };

    const saveNotes = () => {
        update('prop-task-notes', notes);
    };

    const status   = (props['prop-task-status']   as string) || 'opt-todo';
    const priority = (props['prop-task-priority'] as string) || '';
    const due      = (props['prop-task-due']      as string) || '';
    const defer    = (props['prop-task-defer']    as string) || '';
    const myDay    = props['prop-task-my-day']    as boolean;
    const flagged  = props['prop-task-flagged']   as boolean;
    const est      = props['prop-task-estimated'] as number | undefined;
    const recur    = (props['prop-task-recurrence'] as string) || '';
    const section  = (props['prop-task-section']  as string) || '';
    const tags     = (props['prop-task-tags']     as string[]) || [];
    const completedAt = (props['prop-task-completed-at'] as string) || '';
    const recurrenceRule = parseRecurrenceRule(recur);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <button
                        className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1 transition-colors"
                        onClick={() => onOpenFullPage?.(page.id)}
                        title="Open full page"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Full page
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Title */}
                <textarea
                    value={title}
                    onChange={e => { setTitle(e.target.value); setDirty(true); }}
                    onBlur={saveTitle}
                    rows={2}
                    className="w-full text-lg font-semibold text-neutral-900 dark:text-white bg-transparent resize-none outline-none border-0 placeholder:text-neutral-300"
                    placeholder="Task title"
                />

                {/* My Day + Flag toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => update('prop-task-my-day', !myDay)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${myDay
                                ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 text-orange-600'
                                : 'border-neutral-200 dark:border-white/10 text-neutral-500 hover:border-orange-300'
                            }`}
                    >
                        ☀ {myDay ? 'In My Day' : 'Add to My Day'}
                    </button>
                    <button
                        onClick={() => update('prop-task-flagged', !flagged)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${flagged
                                ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-600'
                                : 'border-neutral-200 dark:border-white/10 text-neutral-500 hover:border-red-300'
                            }`}
                    >
                        🚩 {flagged ? 'Flagged' : 'Flag'}
                    </button>
                </div>

                {/* Properties */}
                <div className="rounded-xl border border-neutral-100 dark:border-white/10 divide-y divide-neutral-100 dark:divide-white/5 bg-neutral-50 dark:bg-white/[0.02] px-3">
                    <PropRow label="Status">
                        <Select
                            value={status}
                            options={statusOptions.map(s => ({ id: s.id, label: s.label, icon: s.icon, color: s.color }))}
                            onChange={v => update('prop-task-status', v)}
                        />
                    </PropRow>

                    <PropRow label="Priority">
                        <Select
                            value={priority || 'opt-p4'}
                            options={priorityOptions}
                            onChange={v => update('prop-task-priority', v)}
                        />
                    </PropRow>

                    <PropRow label="Due Date">
                        <input
                            type="date"
                            value={due}
                            min={todayStr()}
                            onChange={e => update('prop-task-due', e.target.value)}
                            className="text-sm bg-transparent text-neutral-700 dark:text-neutral-200 outline-none border border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1 cursor-pointer"
                        />
                    </PropRow>

                    <PropRow label="Defer Until">
                        <input
                            type="date"
                            value={defer}
                            min={todayStr()}
                            onChange={e => update('prop-task-defer', e.target.value)}
                            className="text-sm bg-transparent text-neutral-700 dark:text-neutral-200 outline-none border border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1 cursor-pointer"
                        />
                        {defer && (
                            <button
                                onClick={() => update('prop-task-defer', '')}
                                className="ml-2 text-xs text-neutral-400 hover:text-red-500 transition-colors"
                            >✕</button>
                        )}
                    </PropRow>

                    <PropRow label="Estimate">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="number"
                                value={est ?? ''}
                                min={1}
                                placeholder="0"
                                onChange={e => update('prop-task-estimated', e.target.value ? +e.target.value : null)}
                                className="w-16 text-sm bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 outline-none border border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1"
                            />
                            <span className="text-xs text-neutral-400">minutes</span>
                            {est && est >= 60 && (
                                <span className="text-xs text-neutral-500">({Math.round(est / 60)}h)</span>
                            )}
                        </div>
                    </PropRow>

                    <PropRow label="Recurrence">
                        <input
                            type="text"
                            defaultValue={recur}
                            placeholder="e.g. every monday"
                            onBlur={e => update('prop-task-recurrence', e.target.value)}
                            className="w-full text-sm bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 outline-none border border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1"
                        />
                        {recurrenceRule && (
                            <p className="mt-0.5 text-[11px] text-green-600">↺ Recognized: {recurrenceRule.raw}</p>
                        )}
                    </PropRow>
                </div>

                {/* Notes */}
                <div>
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Notes</p>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        onBlur={saveNotes}
                        rows={4}
                        placeholder="Add notes…"
                        className="w-full text-sm bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none resize-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-400/50 transition-all"
                    />
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map(t => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                    {t.replace('tag-', '#')}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Completed timestamp */}
                {completedAt && (
                    <p className="text-xs text-neutral-400">
                        ✅ Completed {new Date(completedAt).toLocaleDateString()}
                    </p>
                )}
            </div>

            {/* Footer — danger zone */}
            <div className="px-4 py-3 border-t border-neutral-100 dark:border-white/10">
                <button
                    onClick={() => onDelete(page.id)}
                    className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    Delete task
                </button>
            </div>
        </div>
    );
}
