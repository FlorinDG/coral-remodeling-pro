'use client';

import { useState } from 'react';
import {
    Sun, Calendar, CalendarDays, Flag, CheckCircle2,
    Tag, InboxIcon, ChevronRight, Plus, Layers
} from 'lucide-react';
import { Page } from '@/components/admin/database/types';
import { SmartListId, ActivePerspective } from './hooks/useTaskFilter';

// ── Smart list config ─────────────────────────────────────────────────────────

const SMART_LISTS: { id: SmartListId; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'my-day',        label: 'My Day',        icon: Sun,           color: '#f97316' },
    { id: 'today',         label: 'Today',          icon: Calendar,      color: '#3b82f6' },
    { id: 'planned',       label: 'Planned',        icon: CalendarDays,  color: '#8b5cf6' },
    { id: 'flagged',       label: 'Flagged',        icon: Flag,          color: '#ef4444' },
    { id: 'assigned-to-me',label: 'Assigned to Me', icon: InboxIcon,     color: '#06b6d4' },
    { id: 'all',           label: 'All Tasks',      icon: Layers,        color: '#6b7280' },
    { id: 'completed',     label: 'Completed',      icon: CheckCircle2,  color: '#22c55e' },
];

// ── Badge count helper ────────────────────────────────────────────────────────

function countFor(pages: Page[], id: SmartListId, userId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    switch (id) {
        case 'my-day':          return pages.filter(p => p.properties['prop-task-my-day'] === true && !isDone(p)).length;
        case 'today':           return pages.filter(p => !isDone(p) && (p.properties['prop-task-due'] as string)?.slice(0, 10) === today).length;
        case 'planned':         return pages.filter(p => !isDone(p) && !!p.properties['prop-task-due']).length;
        case 'flagged':         return pages.filter(p => p.properties['prop-task-flagged'] === true && !isDone(p)).length;
        case 'assigned-to-me':  return pages.filter(p => { const a = p.properties['prop-task-assignee'] as string[]; return Array.isArray(a) && a.includes(userId) && !isDone(p); }).length;
        case 'all':             return pages.filter(p => !isDone(p)).length;
        case 'completed':       return pages.filter(p => isDone(p)).length;
        default: return 0;
    }
}

function isDone(p: Page) {
    const s = p.properties['prop-task-status'] as string;
    return s === 'opt-done' || s === 'opt-dropped';
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SavedPerspective {
    id: string;
    name: string;
    filters: unknown[];
}

interface TaskSidebarProps {
    pages: Page[];
    userId: string;
    activePerspective: ActivePerspective;
    onSelectPerspective: (p: ActivePerspective) => void;
    savedPerspectives?: SavedPerspective[];
    onNewPerspective?: () => void;
    isEnterprise?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskSidebar({
    pages, userId, activePerspective, onSelectPerspective,
    savedPerspectives = [], onNewPerspective, isEnterprise,
}: TaskSidebarProps) {
    const [tagsExpanded, setTagsExpanded] = useState(true);
    const [perspExpanded, setPerspExpanded] = useState(true);

    // Derive tags from all tasks
    const tagCounts = new Map<string, number>();
    pages.forEach(p => {
        const tags = p.properties['prop-task-tags'] as string[] | undefined;
        if (Array.isArray(tags)) {
            tags.forEach(t => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1));
        }
    });

    const isActive = (p: ActivePerspective) =>
        activePerspective.type === p.type && activePerspective.id === p.id;

    const NavItem = ({ perspective, icon: Icon, label, color, count }: {
        perspective: ActivePerspective;
        icon: React.ElementType;
        label: string;
        color: string;
        count?: number;
    }) => {
        const active = isActive(perspective);
        return (
            <button
                onClick={() => onSelectPerspective(perspective)}
                className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all border
                    ${active
                        ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-950 dark:text-orange-300 font-bold shadow-sm'
                        : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/10 border-transparent'
                    }`}
            >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? color : undefined }} />
                <span className="flex-1 text-left truncate">{label}</span>
                {count !== undefined && count > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border
                        ${active
                            ? 'bg-orange-200 dark:bg-orange-900/50 border-orange-300 dark:border-orange-600 text-orange-900 dark:text-orange-200'
                            : 'bg-neutral-200 dark:bg-white/15 border-neutral-300 dark:border-white/10 text-neutral-800 dark:text-neutral-200'
                        }`}
                    >
                        {count}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto py-4 px-3 gap-1 bg-white dark:bg-neutral-950">
            {/* Smart Lists */}
            <p className="px-3 pb-1.5 text-[10px] font-black text-neutral-800 dark:text-neutral-300 uppercase tracking-wider">Smart Lists</p>
            {SMART_LISTS.map(sl => (
                <NavItem
                    key={sl.id}
                    perspective={{ type: 'smart-list', id: sl.id, name: sl.label }}
                    icon={sl.icon}
                    label={sl.label}
                    color={sl.color}
                    count={countFor(pages, sl.id, userId)}
                />
            ))}

            {/* Tags */}
            {tagCounts.size > 0 && (
                <>
                    <button
                        onClick={() => setTagsExpanded(e => !e)}
                        className="flex items-center gap-2 px-3 pt-4 pb-1.5 text-[10px] font-black text-neutral-800 dark:text-neutral-300 uppercase tracking-wider w-full hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${tagsExpanded ? 'rotate-90' : ''}`} />
                        Tags
                    </button>
                    {tagsExpanded && [...tagCounts.entries()].map(([tagId, count]) => (
                        <button
                            key={tagId}
                            onClick={() => onSelectPerspective({ type: 'tag', id: tagId, name: tagId.replace('tag-', '#'), tagId })}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors border
                                ${isActive({ type: 'tag', id: tagId, name: '' })
                                    ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-950 dark:text-purple-300 font-bold shadow-sm'
                                    : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/10 border-transparent font-semibold'
                                }`}
                        >
                            <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span className="flex-1 text-left">{tagId.replace('tag-', '#')}</span>
                            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-300">{count}</span>
                        </button>
                    ))}
                </>
            )}

            {/* Custom Perspectives (Enterprise) */}
            {isEnterprise && (
                <>
                    <button
                        onClick={() => setPerspExpanded(e => !e)}
                        className="flex items-center gap-2 px-3 pt-4 pb-1.5 text-[10px] font-black text-neutral-800 dark:text-neutral-300 uppercase tracking-wider w-full hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${perspExpanded ? 'rotate-90' : ''}`} />
                        Perspectives
                    </button>
                    {perspExpanded && (
                        <>
                            {savedPerspectives.map(sp => (
                                <NavItem
                                    key={sp.id}
                                    perspective={{ type: 'custom', id: sp.id, name: sp.name, filters: sp.filters as import('@/components/admin/database/types').FilterRule[] }}
                                    icon={Layers}
                                    label={sp.name}
                                    color="#6b7280"
                                />
                            ))}
                            <button
                                onClick={onNewPerspective}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors font-bold border border-dashed border-neutral-300 dark:border-white/10 mt-1"
                            >
                                <Plus className="w-4 h-4" />
                                New Perspective
                            </button>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
