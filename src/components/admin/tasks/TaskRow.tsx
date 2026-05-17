'use client';

import { Page } from '@/components/admin/database/types';
import { todayStr, isDone } from './hooks/useTaskFilter';
import { parseRecurrenceRule } from './RecurrenceEngine';

// ── Priority config ───────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    'opt-p1': { label: 'P1', color: '#ef4444', bg: '#fef2f2' },
    'opt-p2': { label: 'P2', color: '#f97316', bg: '#fff7ed' },
    'opt-p3': { label: 'P3', color: '#eab308', bg: '#fefce8' },
    'opt-p4': { label: 'P4', color: '#9ca3af', bg: '#f9fafb' },
};

export const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    'opt-todo':    { icon: '○',  color: '#9ca3af', label: 'To Do'       },
    'opt-doing':   { icon: '◉',  color: '#3b82f6', label: 'In Progress' },
    'opt-review':  { icon: '◈',  color: '#a855f7', label: 'In Review'   },
    'opt-done':    { icon: '●',  color: '#22c55e', label: 'Done'        },
    'opt-dropped': { icon: '✕',  color: '#ef4444', label: 'Dropped'     },
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
    return { label: formatDate(d), color: '#6b7280' };
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
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-100
                ${selected
                    ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                    : 'hover:bg-neutral-50 dark:hover:bg-white/5 border border-transparent'
                }
                ${done ? 'opacity-55' : ''}
            `}
            onClick={onClick}
            onContextMenu={e => onContextMenu?.(e, page)}
        >
            {/* Status button */}
            <button
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-sm hover:scale-110 transition-transform"
                style={{ color: statusCfg.color }}
                onClick={e => { e.stopPropagation(); onComplete(page); }}
                title={statusCfg.label}
            >
                {statusCfg.icon}
            </button>

            {/* Priority flag */}
            {priorityCfg && (
                <span
                    className="flex-shrink-0 text-[10px] font-bold px-1 py-0.5 rounded"
                    style={{ color: priorityCfg.color, backgroundColor: priorityCfg.bg }}
                >
                    {priorityCfg.label}
                </span>
            )}

            {/* Title */}
            <span className={`flex-1 min-w-0 text-sm font-medium truncate
                ${done ? 'line-through text-neutral-400' : 'text-neutral-900 dark:text-white'}
            `}>
                {(props['title'] as string) || 'Untitled'}
            </span>

            {/* Defer indicator */}
            {deferred && (
                <span className="flex-shrink-0 text-xs text-neutral-400" title={`Deferred until ${defer}`}>💤</span>
            )}

            {/* Recurrence indicator */}
            {recur && parseRecurrenceRule(recur) && (
                <span className="flex-shrink-0 text-xs text-neutral-400" title={recur}>↺</span>
            )}

            {/* Tags */}
            <div className="flex-shrink-0 hidden group-hover:flex items-center gap-1">
                {tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400">
                        {t.replace('tag-', '#')}
                    </span>
                ))}
            </div>

            {/* Estimate */}
            {est && (
                <span className="flex-shrink-0 text-xs text-neutral-400">
                    {est >= 60 ? `${Math.round(est / 60)}h` : `${est}m`}
                </span>
            )}

            {/* Due date */}
            {dueCfg.label && (
                <span className="flex-shrink-0 text-xs" style={{ color: dueCfg.color }}>
                    {dueCfg.label}
                </span>
            )}

            {/* My Day toggle */}
            <button
                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110
                    ${myDay ? '!opacity-100' : ''}
                `}
                style={{ color: myDay ? '#f97316' : '#9ca3af' }}
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
                style={{ color: flagged ? '#ef4444' : '#9ca3af' }}
                onClick={e => { e.stopPropagation(); onToggleFlag(page); }}
                title={flagged ? 'Unflag' : 'Flag'}
            >
                🚩
            </button>
        </div>
    );
}
