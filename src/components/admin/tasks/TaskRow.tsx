'use client';

import { Page } from '@/components/admin/database/types';
import { todayStr, isDone } from './hooks/useTaskFilter';
import { parseRecurrenceRule } from './RecurrenceEngine';
import { Circle, CircleDot, Eye, CheckCircle2, XCircle } from 'lucide-react';

// ── StatusIcon component ──────────────────────────────────────────────────────

export function StatusIcon({ status, className }: { status: string; className?: string }) {
    switch (status) {
        case 'opt-todo':    return <Circle className={className} />;
        case 'opt-doing':   return <CircleDot className={className} />;
        case 'opt-review':  return <Eye className={className} />;
        case 'opt-done':    return <CheckCircle2 className={className} />;
        case 'opt-dropped': return <XCircle className={className} />;
        default:            return <Circle className={className} />;
    }
}

// ── Priority config ───────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    'opt-p1': { label: 'Urgent', color: '#dc2626', bg: '#fef2f2' },
    'opt-p2': { label: 'High',   color: '#ea580c', bg: '#fff7ed' },
    'opt-p3': { label: 'Medium', color: '#ca8a04', bg: '#fefce8' },
    'opt-p4': { label: 'Low',    color: '#4b5563', bg: '#f3f4f6' },
};

export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    'opt-todo':    { color: '#4b5563', label: 'To Do'       },
    'opt-doing':   { color: '#2563eb', label: 'In Progress' },
    'opt-review':  { color: '#7c3aed', label: 'In Review'   },
    'opt-done':    { color: '#16a34a', label: 'Done'        },
    'opt-dropped': { color: '#dc2626', label: 'Dropped'     },
};

// ── Due date helpers ──────────────────────────────────────────────────────────

export function getDueDateDisplay(due: string | undefined): {
    label: string; color: string;
} {
    if (!due) return { label: '', color: '' };
    const today = todayStr();
    const d = due.slice(0, 10);
    if (d < today) return { label: formatDate(d) + ' ⚠', color: '#ef4444' };
    if (d === today) return { label: 'Today', color: '#f97316' };
    return { label: formatDate(d), color: '#4b5563' };
}

function formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface TaskRowProps {
    page: Page;
    selected?: boolean;
    onClick: () => void;
    onComplete: (page: Page) => void;
    onToggleMyDay: (page: Page) => void;
    onToggleFlag: (page: Page) => void;
    onContextMenu?: (e: React.MouseEvent, page: Page) => void;
}

export function TaskRow({
    page, selected, onClick, onComplete, onToggleMyDay, onToggleFlag, onContextMenu
}: TaskRowProps) {
    const props = page.properties;
    const status  = (props['prop-task-status']   as string) || 'opt-todo';
    const priority = props['prop-task-priority']  as string | undefined;
    const due      = props['prop-task-due']       as string | undefined;
    const myDay    = props['prop-task-my-day']    as boolean | undefined;
    const flagged  = props['prop-task-flagged']   as boolean | undefined;
    const tags     = (props['prop-task-tags']     as string[]) || [];
    const est      = props['prop-task-estimated'] as number | undefined;
    const defer    = props['prop-task-defer']     as string | undefined;
    const recur    = props['prop-task-recurrence'] as string | undefined;
    const done     = isDone(page);
    const deferred = defer && defer.slice(0, 10) > todayStr();

    const statusCfg  = STATUS_CONFIG[status]  || STATUS_CONFIG['opt-todo'];
    const priorityCfg = priority ? PRIORITY_CONFIG[priority] : null;
    const dueCfg = getDueDateDisplay(due);

    return (
        <div
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-100 border
                ${selected
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                    : 'hover:bg-neutral-100 dark:hover:bg-white/5 border-transparent'
                }
                ${done ? 'opacity-55' : ''}
            `}
            onClick={onClick}
            onContextMenu={e => onContextMenu?.(e, page)}
        >
            {/* Status button */}
            <button
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:scale-110 transition-all duration-100"
                style={{ color: statusCfg.color }}
                onClick={e => { e.stopPropagation(); onComplete(page); }}
                title={statusCfg.label}
            >
                <StatusIcon status={status} className="w-4.5 h-4.5 stroke-[2.5]" />
            </button>

            {/* Priority tag */}
            {priorityCfg && (
                <span
                    className="flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded border border-current"
                    style={{ color: priorityCfg.color, backgroundColor: priorityCfg.bg }}
                >
                    {priorityCfg.label}
                </span>
            )}

            {/* Title */}
            <span className={`flex-1 min-w-0 text-sm font-semibold truncate
                ${done ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-white'}
            `}>
                {(props['title'] as string) || 'Untitled'}
            </span>

            {/* Defer indicator */}
            {deferred && (
                <span className="flex-shrink-0 text-xs text-neutral-500 dark:text-neutral-400" title={`Deferred until ${defer}`}>💤</span>
            )}

            {/* Recurrence indicator */}
            {recur && parseRecurrenceRule(recur) && (
                <span className="flex-shrink-0 text-xs text-neutral-600 dark:text-neutral-400 font-bold" title={recur}>↺</span>
            )}

            {/* Tags */}
            <div className="flex-shrink-0 hidden group-hover:flex items-center gap-1">
                {tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-white/5">
                        {t.replace('tag-', '#')}
                    </span>
                ))}
            </div>

            {/* Estimate */}
            {est && (
                <span className="flex-shrink-0 text-xs font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                    ⏱ {est >= 60 ? `${Math.round(est / 60)}h` : `${est}m`}
                </span>
            )}

            {/* Due date */}
            {dueCfg.label && (
                <span className="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: dueCfg.color, backgroundColor: dueCfg.color + '15' }}>
                    {dueCfg.label}
                </span>
            )}

            {/* My Day toggle */}
            <button
                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110
                    ${myDay ? '!opacity-100' : ''}
                `}
                style={{ color: myDay ? '#ea580c' : '#4b5563' }}
                onClick={e => { e.stopPropagation(); onToggleMyDay(page); }}
                title={myDay ? 'Remove from My Day' : 'Add to My Day'}
            >
                ☀
            </button>

            {/* Flag */}
            <button
                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110
                    ${flagged ? '!opacity-100' : ''}
                `}
                style={{ color: flagged ? '#dc2626' : '#4b5563' }}
                onClick={e => { e.stopPropagation(); onToggleFlag(page); }}
                title={flagged ? 'Unflag' : 'Flag'}
            >
                🚩
            </button>
        </div>
    );
}
