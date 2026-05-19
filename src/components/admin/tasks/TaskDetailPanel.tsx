'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, ExternalLink, ChevronDown, Calendar, AlertTriangle,
    Circle, CircleDot, Eye, CheckCircle2, XCircle,
    Paperclip, UploadCloud, Trash2, Image, FileText
} from 'lucide-react';
import { Page } from '@/components/admin/database/types';
import { StatusIcon, STATUS_CONFIG, PRIORITY_CONFIG } from './TaskRow';
import { parseRecurrenceRule } from './RecurrenceEngine';
import { todayStr } from './hooks/useTaskFilter';
import { RecurrenceSelector } from './RecurrenceSelector';

interface TaskDetailPanelProps {
    page: Page;
    onClose: () => void;
    onUpdate: (pageId: string, props: Partial<Record<string, unknown>>) => void;
    onDelete: (pageId: string) => void;
    onOpenFullPage?: (pageId: string) => void;
}

interface TaskAttachment {
    id: string;
    name: string;
    url: string; // Base64 data URL
    type: string; // mime type
    size?: number; // size in bytes
}

const statusOptions = Object.entries(STATUS_CONFIG).map(([id, cfg]) => ({ id, ...cfg }));
const priorityOptions = [
    { id: 'opt-p1', label: 'Urgent', color: '#dc2626' },
    { id: 'opt-p2', label: 'High',   color: '#ea580c' },
    { id: 'opt-p3', label: 'Medium', color: '#ca8a04' },
    { id: 'opt-p4', label: 'Low',    color: '#4b5563' },
];

function Select({ value, options, onChange, renderIcon }: {
    value: string;
    options: { id: string; label?: string; color?: string }[];
    onChange: (v: string) => void;
    renderIcon?: (id: string) => React.ReactNode;
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-350 dark:border-white/20 text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-white/5 transition-all bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
                style={{ color: current?.color }}
            >
                {renderIcon && renderIcon(value)}
                {current?.label || value}
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            {open && (
                <div className="absolute top-full mt-1.5 left-0 z-50 bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-white/25 rounded-xl shadow-xl py-1.5 min-w-[180px]">
                    {options.map(o => (
                        <button
                            key={o.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-left font-semibold"
                            style={{ color: o.color }}
                            onClick={() => { onChange(o.id); setOpen(false); }}
                        >
                            {renderIcon && renderIcon(o.id)}
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
        <div className="flex items-start gap-3 py-2.5 border-b border-neutral-200 dark:border-white/10 last:border-0">
            <span className="w-28 flex-shrink-0 text-xs font-black text-neutral-850 dark:text-neutral-300 pt-1.5">{label}</span>
            <div className="flex-1">{children}</div>
        </div>
    );
}

export function TaskDetailPanel({ page, onClose, onUpdate, onDelete, onOpenFullPage }: TaskDetailPanelProps) {
    const props = page.properties;
    const [title, setTitle]   = useState((props['title'] as string) || '');
    const [notes, setNotes]   = useState((props['prop-task-notes'] as string) || '');
    const [dirty, setDirty]   = useState(false);

    const [prevPageId, setPrevPageId] = useState(page.id);
    if (page.id !== prevPageId) {
        setPrevPageId(page.id);
        setTitle((props['title'] as string) || '');
        setNotes((props['prop-task-notes'] as string) || '');
        setDirty(false);
    }

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
    const tags     = (props['prop-task-tags']     as string[]) || [];
    const completedAt = (props['prop-task-completed-at'] as string) || '';
    const recurrenceRule = parseRecurrenceRule(recur);

    // Retrieve attachments list from property
    const attachments = (props['prop-task-attachments'] as TaskAttachment[]) || [];

    // File Upload Handler
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newAttachments = [...attachments];

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newAttachments.push({
                    id: 'attach-' + Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    url: reader.result as string,
                    type: file.type || 'application/octet-stream',
                    size: file.size
                });
                update('prop-task-attachments', newAttachments);
            };
            reader.readAsDataURL(file);
        });
        // Reset file input
        e.target.value = '';
    };

    const handleDeleteAttachment = (attachId: string) => {
        const filtered = attachments.filter(a => a.id !== attachId);
        update('prop-task-attachments', filtered);
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const dm = 1;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const photos = attachments.filter(a => a.type.startsWith('image/'));
    const docFiles = attachments.filter(a => !a.type.startsWith('image/'));

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950 border-l border-neutral-300 dark:border-white/20 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-300 dark:border-white/20 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center gap-2">
                    <button
                        className="text-xs font-bold text-neutral-850 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 transition-colors bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 px-2 py-1 rounded shadow-sm"
                        onClick={() => onOpenFullPage?.(page.id)}
                        title="Open full page"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Full Page View
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 transition-colors border border-neutral-300 dark:border-white/10 shadow-sm"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white dark:bg-neutral-950">
                {/* Title */}
                <textarea
                    value={title}
                    onChange={e => { setTitle(e.target.value); setDirty(true); }}
                    onBlur={saveTitle}
                    rows={2}
                    className="w-full text-lg font-black text-neutral-900 dark:text-white bg-transparent resize-none outline-none border border-neutral-300 dark:border-white/20 rounded-xl p-3 focus:ring-2 focus:ring-orange-500/50 shadow-sm placeholder:text-neutral-400"
                    placeholder="Task title"
                />

                {/* My Day + Flag toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => update('prop-task-my-day', !myDay)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm
                            ${myDay
                                ? 'bg-orange-100 border-orange-400 text-orange-900 font-extrabold'
                                : 'border-neutral-300 dark:border-white/20 text-neutral-700 dark:text-neutral-300 hover:border-orange-400 hover:bg-orange-50/20'
                            }`}
                    >
                        ☀ {myDay ? 'In My Day' : 'Add to My Day'}
                    </button>
                    <button
                        onClick={() => update('prop-task-flagged', !flagged)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm
                            ${flagged
                                ? 'bg-red-100 border-red-400 text-red-900 font-extrabold'
                                : 'border-neutral-300 dark:border-white/20 text-neutral-700 dark:text-neutral-300 hover:border-red-400 hover:bg-red-50/20'
                            }`}
                    >
                        🚩 {flagged ? 'Flagged' : 'Flag'}
                    </button>
                </div>

                {/* Properties */}
                <div className="rounded-xl border border-neutral-300 dark:border-white/25 divide-y divide-neutral-250 dark:divide-white/10 bg-neutral-50/80 dark:bg-white/[0.02] px-3 shadow-md">
                    <PropRow label="Status">
                        <Select
                            value={status}
                            options={statusOptions.map(s => ({ id: s.id, label: s.label, color: s.color }))}
                            onChange={v => update('prop-task-status', v)}
                            renderIcon={(id) => <StatusIcon status={id} className="w-4 h-4 stroke-[2.5]" />}
                        />
                    </PropRow>

                    <PropRow label="Priority">
                        <Select
                            value={priority || 'opt-p4'}
                            options={priorityOptions}
                            onChange={v => update('prop-task-priority', v)}
                            renderIcon={(id) => <span className="text-xs">●</span>}
                        />
                    </PropRow>

                    <PropRow label="Due Date">
                        <input
                            type="date"
                            value={due}
                            min={todayStr()}
                            onChange={e => update('prop-task-due', e.target.value)}
                            className="text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-semibold outline-none border border-neutral-300 dark:border-white/20 rounded-lg px-2.5 py-1.5 cursor-pointer shadow-sm focus:ring-1 focus:ring-orange-500/50"
                        />
                    </PropRow>

                    <PropRow label="Defer Until">
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                value={defer}
                                min={todayStr()}
                                onChange={e => update('prop-task-defer', e.target.value)}
                                className="text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-semibold outline-none border border-neutral-300 dark:border-white/20 rounded-lg px-2.5 py-1.5 cursor-pointer shadow-sm focus:ring-1 focus:ring-orange-500/50"
                            />
                            {defer && (
                                <button
                                    onClick={() => update('prop-task-defer', '')}
                                    className="ml-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 border border-neutral-300 dark:border-white/10 text-xs transition-colors shadow-sm"
                                >✕</button>
                            )}
                        </div>
                    </PropRow>

                    <PropRow label="Estimate">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="number"
                                value={est ?? ''}
                                min={1}
                                placeholder="0"
                                onChange={e => update('prop-task-estimated', e.target.value ? +e.target.value : null)}
                                className="w-20 text-sm font-bold bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none border border-neutral-300 dark:border-white/20 rounded-lg px-2.5 py-1.5 shadow-sm focus:ring-1 focus:ring-orange-500/50"
                            />
                            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-300">minutes</span>
                            {est && est >= 60 && (
                                <span className="text-xs font-black text-neutral-900 dark:text-neutral-200 bg-neutral-200 dark:bg-white/10 px-1.5 py-0.5 rounded">({Math.round(est / 60)}h)</span>
                            )}
                        </div>
                    </PropRow>

                    <PropRow label="Recurrence">
                        <RecurrenceSelector
                            value={recur}
                            onChange={v => update('prop-task-recurrence', v)}
                        />
                        {recurrenceRule && (
                            <p className="mt-1 text-[11px] font-black text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-800/30 inline-block">
                                ↺ Recognized: {recurrenceRule.raw}
                            </p>
                        )}
                    </PropRow>
                </div>

                {/* Notes */}
                <div>
                    <p className="text-xs font-black text-neutral-800 dark:text-neutral-300 mb-1.5 uppercase tracking-wider">Notes</p>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        onBlur={saveNotes}
                        rows={4}
                        placeholder="Add notes…"
                        className="w-full text-sm bg-neutral-50 dark:bg-white/[0.02] text-neutral-900 dark:text-white border border-neutral-300 dark:border-white/20 rounded-xl px-3.5 py-2.5 outline-none resize-none placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/50 shadow-md transition-all font-semibold"
                    />
                </div>

                {/* Attachments Section */}
                <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black text-neutral-850 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                            Attachments
                        </p>
                        <label className="text-xs font-bold text-orange-950 dark:text-orange-300 hover:text-orange-900 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 hover:scale-102 transition-transform">
                            <UploadCloud className="w-3.5 h-3.5" />
                            Add Attachments
                            <input
                                type="file"
                                multiple
                                onChange={handleUpload}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {attachments.length === 0 ? (
                        <div className="border border-dashed border-neutral-300 dark:border-white/10 rounded-xl p-4 text-center bg-neutral-50 dark:bg-white/[0.01]">
                            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-450">No photos or files attached</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Photos Grid */}
                            {photos.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Photos</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {photos.map(p => (
                                            <div key={p.id} className="group/photo relative aspect-square border border-neutral-350 dark:border-white/20 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 shadow-sm">
                                                <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                                                    <button
                                                        onClick={() => handleDeleteAttachment(p.id)}
                                                        className="self-end w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors shadow"
                                                        title="Delete Photo"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    <a
                                                        href={p.url}
                                                        download={p.name}
                                                        className="block text-[9px] font-bold text-white truncate text-center hover:underline"
                                                        title={p.name}
                                                    >
                                                        {p.name}
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Documents List */}
                            {docFiles.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Documents</h4>
                                    <div className="space-y-1.5">
                                        {docFiles.map(d => (
                                            <div key={d.id} className="flex items-center justify-between p-2 rounded-xl border border-neutral-300 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02] shadow-sm">
                                                <a href={d.url} download={d.name} className="flex items-center gap-2 flex-1 min-w-0 hover:underline">
                                                    <FileText className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{d.name}</p>
                                                        <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-semibold">{formatSize(d.size)}</p>
                                                    </div>
                                                </a>
                                                <button
                                                    onClick={() => handleDeleteAttachment(d.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 border border-neutral-300 dark:border-white/10 transition-colors shadow-sm ml-2"
                                                    title="Delete Document"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                    <div>
                        <p className="text-xs font-black text-neutral-850 dark:text-neutral-300 mb-1.5 uppercase tracking-wider">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map(t => (
                                <span key={t} className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-300 shadow-sm">
                                    {t.replace('tag-', '#')}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Completed timestamp */}
                {completedAt && (
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-300">
                        ✅ Completed {new Date(completedAt).toLocaleDateString()}
                    </p>
                )}
            </div>

            {/* Footer — danger zone */}
            <div className="px-4 py-3 border-t border-neutral-300 dark:border-white/20 bg-neutral-50 dark:bg-neutral-950">
                <button
                    onClick={() => onDelete(page.id)}
                    className="w-full py-2 text-xs font-black text-red-700 hover:text-white hover:bg-red-600 dark:text-red-400 dark:hover:bg-red-950/40 border border-red-300 dark:border-red-900/50 rounded-lg transition-all shadow-sm"
                >
                    Delete Task
                </button>
            </div>
        </div>
    );
}
