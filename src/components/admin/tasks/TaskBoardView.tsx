'use client';

import { useState, useRef, useEffect } from 'react';
import { Page } from '@/components/admin/database/types';
import { STATUS_CONFIG, PRIORITY_CONFIG, getDueDateDisplay } from './TaskRow';
import { CalendarDays, Paperclip } from 'lucide-react';

interface TaskBoardViewProps {
    pages: Page[];
    onUpdateStatus: (pageId: string, status: string) => void;
    onPageClick: (page: Page) => void;
    onUpdateTitle?: (pageId: string, title: string) => void;
    onUpdatePriority?: (pageId: string, priority: string) => void;
    onUpdateDue?: (pageId: string, due: string) => void;
}

// ── Inline Editable Title ─────────────────────────────────────────────────────
function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) {
            onSave(trimmed);
        } else {
            setDraft(value);
        }
        setEditing(false);
    };

    if (!editing) {
        return (
            <h4
                className="text-sm font-bold text-neutral-950 dark:text-neutral-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 mb-2.5 cursor-text"
                onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                }}
                title="Click to edit title"
            >
                {value || 'Untitled'}
            </h4>
        );
    }

    return (
        <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm font-bold text-neutral-950 dark:text-neutral-100 bg-transparent border-b-2 border-orange-400 dark:border-orange-500 outline-none mb-2.5 py-0.5 placeholder:text-neutral-400"
            placeholder="Task name"
        />
    );
}

// ── Priority Cycle Order ──────────────────────────────────────────────────────
const PRIORITY_CYCLE = ['opt-p4', 'opt-p3', 'opt-p2', 'opt-p1'];

export function TaskBoardView({ pages, onUpdateStatus, onPageClick, onUpdateTitle, onUpdatePriority, onUpdateDue }: TaskBoardViewProps) {
    const activeTasks = pages.filter(p => {
        const s = p.properties['prop-task-status'] as string;
        return s !== 'opt-dropped';
    });

    const columns = Object.entries(STATUS_CONFIG).filter(([id]) => id !== 'opt-dropped');

    // HTML5 Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, pageId: string) => {
        e.dataTransfer.setData('text/plain', pageId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        const pageId = e.dataTransfer.getData('text/plain');
        if (pageId) {
            onUpdateStatus(pageId, targetStatus);
        }
    };

    return (
        <div className="flex-1 flex gap-4 p-4 lg:p-6 overflow-x-auto min-h-0 bg-neutral-100/30 dark:bg-neutral-950/20">
            {columns.map(([statusId, cfg]) => {
                const columnTasks = activeTasks.filter(
                    p => (p.properties['prop-task-status'] as string || 'opt-todo') === statusId
                );

                return (
                    <div
                        key={statusId}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, statusId)}
                        className="flex-shrink-0 w-80 flex flex-col bg-neutral-200/50 dark:bg-neutral-900/60 rounded-2xl border border-neutral-300 dark:border-white/20 p-3 min-h-0 shadow-md"
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-3.5 px-1.5 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-neutral-950 dark:text-neutral-100 uppercase tracking-widest">
                                    {cfg.label}
                                </span>
                                <span className="text-xs bg-neutral-350 dark:bg-white/15 text-neutral-900 dark:text-neutral-200 px-2 py-0.5 rounded-full font-bold border border-neutral-405/20 shadow-sm">
                                    {columnTasks.length}
                                </span>
                            </div>
                        </div>

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[150px]">
                            {columnTasks.map(page => {
                                const props = page.properties;
                                const priority = props['prop-task-priority'] as string | undefined;
                                const due = props['prop-task-due'] as string | undefined;
                                const tags = (props['prop-task-tags'] as string[]) || [];

                                const priorityCfg = priority ? PRIORITY_CONFIG[priority] : null;
                                const dueCfg = getDueDateDisplay(due);

                                return (
                                    <div
                                        key={page.id}
                                        draggable
                                        onDragStart={e => handleDragStart(e, page.id)}
                                        onClick={() => onPageClick(page)}
                                        className="group p-3.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-white/15 rounded-xl shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing hover:border-orange-350 dark:hover:border-orange-900/80 transition-all"
                                    >
                                        {/* Tags */}
                                        {tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2.5">
                                                {tags.slice(0, 2).map(t => (
                                                    <span key={t} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800/40 shadow-sm">
                                                        {t.replace('tag-', '#')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Title — inline editable */}
                                        {onUpdateTitle ? (
                                            <EditableTitle
                                                value={(props['title'] as string) || 'Untitled'}
                                                onSave={(v) => onUpdateTitle(page.id, v)}
                                            />
                                        ) : (
                                            <h4 className="text-sm font-bold text-neutral-950 dark:text-neutral-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 mb-2.5">
                                                {(props['title'] as string) || 'Untitled'}
                                            </h4>
                                        )}

                                        {/* ── Action Bar ── */}
                                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                            {/* Priority pill — click to cycle */}
                                            {onUpdatePriority && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const currentIdx = PRIORITY_CYCLE.indexOf(priority || 'opt-p4');
                                                        const nextIdx = (currentIdx + 1) % PRIORITY_CYCLE.length;
                                                        onUpdatePriority(page.id, PRIORITY_CYCLE[nextIdx]);
                                                    }}
                                                    className="text-[10px] font-black px-2 py-0.5 rounded border border-current transition-all hover:scale-105 active:scale-95"
                                                    style={{
                                                        color: priorityCfg?.color || '#9ca3af',
                                                        backgroundColor: priorityCfg?.bg || '#f9fafb',
                                                    }}
                                                    title="Click to change priority"
                                                >
                                                    {priorityCfg?.label || 'Low'}
                                                </button>
                                            )}

                                            {/* Due date — compact date input */}
                                            {onUpdateDue && (
                                                <label className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 transition-colors" style={{ color: dueCfg.color || '#6b7280' }}>
                                                    <CalendarDays className="w-3 h-3" />
                                                    <span>{dueCfg.label || 'Set date'}</span>
                                                    <input
                                                        type="date"
                                                        value={due || ''}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            onUpdateDue(page.id, e.target.value);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="absolute opacity-0 w-0 h-0 pointer-events-none"
                                                    />
                                                </label>
                                            )}

                                            {/* Attachment indicator */}
                                            {(page.blocks?.length ?? 0) > 0 && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-neutral-400 font-bold" title={`${page.blocks?.length} block(s)`}>
                                                    <Paperclip className="w-3 h-3" />
                                                    {page.blocks?.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-250 dark:border-white/10">
                                            {/* Due Date (keep in footer as secondary indicator) */}
                                            {dueCfg.label && (
                                                <span className="font-bold bg-neutral-100/50 dark:bg-white/5 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/5 shadow-sm" style={{ color: dueCfg.color }}>
                                                    {dueCfg.label}
                                                </span>
                                            )}
                                            {!dueCfg.label && <span />}
                                            {/* Tags in footer */}
                                            {tags.length > 0 && (
                                                <div className="flex items-center gap-0.5">
                                                    {tags.slice(0, 2).map(t => (
                                                        <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-500">
                                                            {t.replace('tag-', '#')}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {columnTasks.length === 0 && (
                                <div className="h-28 border border-dashed border-neutral-350 dark:border-white/15 rounded-xl flex items-center justify-center text-xs font-bold text-neutral-500 bg-neutral-50/20 dark:bg-white/[0.01] select-none">
                                    Drag tasks here
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
