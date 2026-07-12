'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
    X, ExternalLink, ChevronDown, Calendar, AlertTriangle,
    Circle, CircleDot, Eye, CheckCircle2, XCircle,
    Paperclip, UploadCloud, Trash2, Image, FileText,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';

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

    );
}

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
    url: string; // Base64 data URL or Blob key
    type: string; // mime type
    size?: number; // size in bytes
    uploading?: boolean;
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
    const [pos, setPos] = useState<{ top: number; left: number; width: number; placement: 'bottom' | 'top' } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find(o => o.id === value);

    useLayoutEffect(() => {
        if (open && ref.current) {
            const updatePosition = () => {
                if (!ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const placement = spaceBelow < 260 && rect.top > spaceBelow ? 'top' : 'bottom';
                setPos({
                    top: placement === 'top' ? rect.top - 6 : rect.bottom + 6,
                    left: rect.left,
                    width: Math.max(rect.width, 180),
                    placement
                });
            };
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, { capture: true, passive: true });
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, { capture: true });
            };
        }
    }, [open]);

    useEffect(() => {
        const clickAway = (e: MouseEvent) => {
            const popover = document.querySelector('[data-select-popover="true"]');
            if (
                ref.current && !ref.current.contains(e.target as Node) &&
                popover && !popover.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        if (open) {
            document.addEventListener('mousedown', clickAway, true);
            document.addEventListener('keydown', handleKeyDown, true);
        }
        return () => {
            document.removeEventListener('mousedown', clickAway, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-white/10 text-xs font-bold hover:border-orange-400 dark:hover:border-orange-500/50 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-all bg-white dark:bg-neutral-900 text-neutral-850 dark:text-neutral-200 shadow-sm active:scale-98"
                style={{ color: current?.color }}
            >
                {renderIcon && renderIcon(value)}
                {current?.label || value}
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    data-select-popover="true"
                    className="fixed z-[99999] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-300 dark:border-white/10 rounded-2xl shadow-xl py-1.5 min-w-[180px] max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
                    style={pos.placement === 'top'
                        ? { bottom: window.innerHeight - pos.top, left: pos.left, width: pos.width }
                        : { top: pos.top, left: pos.left, width: pos.width }
                    }
                >
                    {options.map(o => (
                        <button
                            key={o.id}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-left"
                            style={{ color: o.color }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(o.id);
                                setOpen(false);
                            }}
                        >
                            {renderIcon && renderIcon(o.id)}
                            {o.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-neutral-100 dark:border-white/5 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] -mx-3 px-3 first:rounded-t-2xl last:rounded-b-2xl transition-colors">
            <span className="w-28 flex-shrink-0 text-xs font-bold text-neutral-500 dark:text-neutral-450">{label}</span>
            <div className="flex-1 flex items-center">{children}</div>
        </div>
    );
}

export function TaskDetailPanel({ page, onClose, onUpdate, onDelete, onOpenFullPage }: TaskDetailPanelProps) {
    const props = page.properties;
    const [title, setTitle]   = useState((props['title'] as string) || '');
    const [notes, setNotes]   = useState((props['prop-task-notes'] as string) || '');
    const [dirty, setDirty]   = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const savedTimeout = useRef<NodeJS.Timeout | null>(null);

    const triggerSavedIndicator = () => {
        setShowSaved(true);
        if (savedTimeout.current) clearTimeout(savedTimeout.current);
        savedTimeout.current = setTimeout(() => {
            setShowSaved(false);
        }, 2000);
    };

    const [prevPageId, setPrevPageId] = useState(page.id);
    if (page.id !== prevPageId) {
        setPrevPageId(page.id);
        setTitle((props['title'] as string) || '');
        setNotes((props['prop-task-notes'] as string) || '');
        setDirty(false);
        setShowSaved(false);
    }

    useEffect(() => {
        if (page.id !== prevPageId && savedTimeout.current) {
            clearTimeout(savedTimeout.current);
        }
    }, [page.id, prevPageId]);

    useEffect(() => {
        return () => {
            if (savedTimeout.current) {
                clearTimeout(savedTimeout.current);
            }
        };
    }, []);

    const update = (key: string, value: unknown) => {
        onUpdate(page.id, { [key]: value });
        triggerSavedIndicator();
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
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const filesArray = Array.from(files);
        const { uploadFileAction } = await import('@/app/actions/files');

        // Create temporary attachments to show uploading state
        const tempAttachments = filesArray.map(file => ({
            id: 'temp-' + Math.random().toString(36).substr(2, 9),
            name: file.name,
            url: '',
            type: file.type || 'application/octet-stream',
            size: file.size,
            uploading: true
        }));

        let currentAttachments = [...attachments, ...tempAttachments];
        update('prop-task-attachments', currentAttachments);

        // Upload in parallel
        await Promise.all(filesArray.map(async (file, index) => {
            const tempId = tempAttachments[index].id;
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await uploadFileAction(formData, 'task', page.id);
                if (res.success && res.key) {
                    currentAttachments = currentAttachments.map(att => 
                        att.id === tempId 
                            ? {
                                id: 'attach-' + Math.random().toString(36).substr(2, 9),
                                name: file.name,
                                url: res.key,
                                type: file.type || 'application/octet-stream',
                                size: file.size
                              }
                            : att
                    );
                } else {
                    toast.error(`Fout bij uploaden van ${file.name}: ${res.error || 'Onbekende fout'}`);
                    currentAttachments = currentAttachments.filter(att => att.id !== tempId);
                }
            } catch (err) {
                console.error(err);
                toast.error(`Fout bij uploaden van ${file.name}`);
                currentAttachments = currentAttachments.filter(att => att.id !== tempId);
            }

            update('prop-task-attachments', currentAttachments);
        }));

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

    const getAttachmentUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/api/files/')) return url;
        if (url.startsWith('t_')) return `/api/files/${url}`;
        return `/api/files/${url}`;
    };

    const photos = attachments.filter(a => a.type.startsWith('image/') && !a.uploading);
    const docFiles = attachments.filter(a => !a.type.startsWith('image/') && !a.uploading);
    const uploadingList = attachments.filter(a => a.uploading);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950 border-l border-neutral-300 dark:border-white/20 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-300 dark:border-white/20 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center gap-2.5">
                    <button
                        className="text-xs font-bold text-neutral-850 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 transition-colors bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 px-2 py-1 rounded shadow-sm"
                        onClick={() => onOpenFullPage?.(page.id)}
                        title="Open full page"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Full Page View
                    </button>

                    {showSaved && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-[10px] font-black text-green-600 dark:text-green-400 tracking-wider uppercase transition-all duration-300 select-none animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Saved
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 transition-colors border border-neutral-300 dark:border-white/10 shadow-sm"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white dark:bg-neutral-950 min-h-0">
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
                        <CustomDatePicker
                            value={due}
                            min={todayStr()}
                            onChange={v => update('prop-task-due', v)}
                            placeholder="Set due date"
                        />
                    </PropRow>

                    <PropRow label="Defer Until">
                        <CustomDatePicker
                            value={defer}
                            min={todayStr()}
                            onChange={v => update('prop-task-defer', v)}
                            placeholder="Set defer date"
                        />
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
                <div className="rounded-2xl border border-neutral-300 dark:border-white/10 bg-neutral-50/30 dark:bg-white/[0.01] p-4 shadow-sm hover:border-neutral-350 dark:hover:border-white/20 transition-all">
                    <p className="text-[10px] font-black text-neutral-500 dark:text-neutral-450 mb-2.5 uppercase tracking-widest">Notes</p>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        onBlur={saveNotes}
                        rows={4}
                        placeholder="Add notes or task instructions…"
                        className="w-full text-sm bg-transparent text-neutral-900 dark:text-white outline-none resize-none placeholder:text-neutral-400 focus:ring-0 font-semibold"
                    />
                </div>

                {/* Attachments Section */}
                <div className="rounded-2xl border border-neutral-300 dark:border-white/10 bg-neutral-50/30 dark:bg-white/[0.01] p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3.5">
                        <p className="text-[10px] font-black text-neutral-500 dark:text-neutral-450 uppercase tracking-widest flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                            Attachments
                        </p>
                        <label className="text-xs font-bold text-orange-650 hover:text-white dark:text-orange-400 dark:hover:text-white hover:bg-[var(--brand-color,#d35400)] dark:hover:bg-[var(--brand-color,#d35400)] border border-orange-350/60 dark:border-orange-500/30 px-3 py-1.5 rounded-xl shadow-sm cursor-pointer flex items-center gap-1.5 transition-all active:scale-98">
                            <UploadCloud className="w-3.5 h-3.5" />
                            Upload Files
                            <input
                                type="file"
                                multiple
                                onChange={handleUpload}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {attachments.length === 0 ? (
                        <div className="border border-dashed border-neutral-300 dark:border-white/10 rounded-xl p-4 text-center bg-neutral-50/20 dark:bg-white/[0.005]">
                            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-450">No photos or files attached</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Photos Grid */}
                            {photos.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Photos</h4>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        {photos.map(p => (
                                            <div key={p.id} className="group/photo relative aspect-square border border-neutral-300 dark:border-white/10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 shadow-sm transition-all hover:scale-[1.02]">
                                                <img src={getAttachmentUrl(p.url)} alt={p.name} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 backdrop-blur-sm bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                                    <button
                                                        onClick={() => handleDeleteAttachment(p.id)}
                                                        className="self-end w-6 h-6 rounded-full bg-red-650 text-white flex items-center justify-center hover:bg-red-750 transition-colors shadow-lg active:scale-90"
                                                        title="Delete Photo"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <a
                                                        href={getAttachmentUrl(p.url)}
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
                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Documents</h4>
                                    <div className="space-y-2">
                                        {docFiles.map(d => (
                                            <div key={d.id} className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/40 dark:bg-white/[0.01] hover:border-orange-300 dark:hover:border-orange-500/30 transition-all shadow-sm">
                                                <a href={getAttachmentUrl(d.url)} download={d.name} className="flex items-center gap-2.5 flex-1 min-w-0 hover:underline text-neutral-800 dark:text-neutral-200">
                                                    <FileText className="w-4 h-4 text-neutral-550 dark:text-neutral-400 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{d.name}</p>
                                                        <p className="text-[9px] text-neutral-500 dark:text-neutral-450 font-semibold">{formatSize(d.size)}</p>
                                                    </div>
                                                </a>
                                                <button
                                                    onClick={() => handleDeleteAttachment(d.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 border border-neutral-250 dark:border-white/10 transition-colors shadow-sm ml-2 active:scale-90"
                                                    title="Delete Document"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Uploading Files List */}
                            {uploadingList.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                        Uploading...
                                    </h4>
                                    <div className="space-y-2">
                                        {uploadingList.map(u => (
                                            <div key={u.id} className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-250 dark:border-white/15 bg-neutral-50/20 dark:bg-white/[0.005]">
                                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                    <div className="w-4 h-4 flex items-center justify-center">
                                                        <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 truncate">{u.name}</p>
                                                        <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-semibold">{formatSize(u.size)}</p>
                                                    </div>
                                                </div>
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
                    <div className="rounded-2xl border border-neutral-300 dark:border-white/10 bg-neutral-50/30 dark:bg-white/[0.01] p-4 shadow-sm">
                        <p className="text-[10px] font-black text-neutral-550 dark:text-neutral-400 mb-2.5 uppercase tracking-widest">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map(t => (
                                <span key={t} className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100/50 dark:bg-purple-900/20 border border-purple-250 dark:border-purple-800/40 text-purple-950 dark:text-purple-300 shadow-sm hover:scale-102 transition-transform cursor-default">
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

            {/* Footer — Save & Close + Delete */}
            <div className="px-4 py-3 border-t border-neutral-300 dark:border-white/20 bg-neutral-50 dark:bg-neutral-950 flex items-center gap-2">
                <button
                    onClick={() => {
                        saveTitle();
                        saveNotes();
                        onClose();
                    }}
                    className="flex-1 py-2 text-xs font-bold text-white bg-[var(--brand-color,#d35400)] hover:bg-[var(--brand-color,#d35400)]/90 rounded-lg transition-all shadow-md active:scale-98 text-center animate-fade-in"
                >
                    Save & Close
                </button>
                <button
                    onClick={() => onDelete(page.id)}
                    className="w-9 h-9 flex flex-shrink-0 items-center justify-center rounded-lg hover:bg-red-500 hover:text-white dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-neutral-300 dark:border-white/10 transition-colors shadow-sm"
                    title="Delete Task"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
