'use client';

import { useState } from 'react';
import { Page } from '@/components/admin/database/types';
import { TaskRow } from './TaskRow';
import { TaskGroup } from './hooks/useTaskFilter';
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react';

interface TaskListViewProps {
    perspectiveName: string;
    groups: TaskGroup[];
    selectedPageId?: string;
    onPageClick: (page: Page) => void;
    onComplete: (page: Page) => void;
    onToggleMyDay: (page: Page) => void;
    onToggleFlag: (page: Page) => void;
    onContextMenu: (e: React.MouseEvent, page: Page) => void;
    onDelete?: (page: Page) => void;
}

export function TaskListView({
    perspectiveName,
    groups,
    selectedPageId,
    onPageClick,
    onComplete,
    onToggleMyDay,
    onToggleFlag,
    onContextMenu,
    onDelete,
}: TaskListViewProps) {
    // Keep track of collapsed section IDs
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const toggleSection = (id: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const hasTasks = groups.some(g => g.tasks.length > 0);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-100/30 dark:bg-neutral-950/20 p-4 lg:p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-neutral-900 dark:text-white capitalize flex items-center gap-2">
                    {perspectiveName}
                </h2>
                <span className="text-xs text-neutral-800 dark:text-neutral-200 font-bold bg-neutral-200 dark:bg-white/15 px-2.5 py-1 rounded-full border border-neutral-300 dark:border-white/10 shadow-sm">
                    {groups.reduce((acc, g) => acc + g.tasks.length, 0)} tasks
                </span>
            </div>

            {/* Empty State */}
            {!hasTasks ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-neutral-300 dark:border-white/20 rounded-2xl bg-white dark:bg-neutral-950/20 max-w-lg mx-auto w-full my-auto shadow-md">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-3 border border-neutral-200 dark:border-white/10">
                        <Inbox className="w-6 h-6 text-neutral-600 dark:text-neutral-300" />
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">No tasks here</h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xs">
                        All clear! You don&apos;t have any tasks in this view. Use the NLP quick-add bar at the bottom to create one.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map(group => {
                        const collapsed = collapsedSections[group.sectionId];
                        const count = group.tasks.length;

                        // High contrast border/bg coloring based on section
                        const sectionColors: Record<string, { bg: string; text: string; dot: string }> = {
                            'sec-planning':  { bg: 'bg-amber-100/70 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50', text: 'text-amber-900 dark:text-amber-300', dot: 'bg-amber-600' },
                            'sec-execution': { bg: 'bg-orange-100/70 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800/50', text: 'text-orange-900 dark:text-orange-300', dot: 'bg-orange-600' },
                            'sec-review':    { bg: 'bg-emerald-100/70 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-900 dark:text-emerald-300', dot: 'bg-emerald-600' },
                            'sec-admin':     { bg: 'bg-neutral-100 dark:bg-neutral-800/40 border-b border-neutral-200 dark:border-neutral-700/50', text: 'text-neutral-900 dark:text-neutral-200', dot: 'bg-neutral-600' },
                        };

                        const colors = sectionColors[group.sectionId] || { bg: 'bg-neutral-100 dark:bg-neutral-800/40 border-b border-neutral-200 dark:border-neutral-700/50', text: 'text-neutral-900 dark:text-neutral-200', dot: 'bg-neutral-600' };

                        return (
                            <div
                                key={group.sectionId}
                                className={`rounded-xl border border-neutral-300 dark:border-white/10 bg-white dark:bg-neutral-950 overflow-hidden transition-all duration-100 shadow-md`}
                            >
                                {/* Section Header */}
                                <div
                                    onClick={() => toggleSection(group.sectionId)}
                                    className={`flex items-center gap-2 px-3.5 py-3 cursor-pointer hover:bg-neutral-200/50 dark:hover:bg-white/5 select-none ${colors.bg}`}
                                >
                                    {collapsed ? (
                                        <ChevronRight className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                                    )}
                                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                    <span className={`text-xs font-black uppercase tracking-widest ${colors.text}`}>
                                        {group.sectionName}
                                    </span>
                                    <span className="text-xs bg-white/80 dark:bg-white/10 text-neutral-800 dark:text-neutral-255 border border-neutral-300 dark:border-white/10 px-2.5 py-0.5 rounded-full font-bold ml-auto shadow-sm">
                                        {count}
                                    </span>
                                </div>

                                {/* Section Tasks */}
                                {!collapsed && (
                                    <div className="p-3 space-y-1.5 bg-white dark:bg-neutral-950">
                                        {group.tasks.map(page => (
                                            <TaskRow
                                                key={page.id}
                                                page={page}
                                                selected={page.id === selectedPageId}
                                                onClick={() => onPageClick(page)}
                                                onComplete={onComplete}
                                                onToggleMyDay={onToggleMyDay}
                                                onToggleFlag={onToggleFlag}
                                                onContextMenu={onContextMenu}
                                                onDelete={onDelete}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
