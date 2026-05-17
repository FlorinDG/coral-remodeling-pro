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
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-50/50 dark:bg-neutral-900/10 p-4 lg:p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white capitalize flex items-center gap-2">
                    {perspectiveName}
                </h2>
                <span className="text-xs text-neutral-500 font-medium bg-neutral-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                    {groups.reduce((acc, g) => acc + g.tasks.length, 0)} tasks
                </span>
            </div>

            {/* Empty State */}
            {!hasTasks ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-neutral-200 dark:border-white/10 rounded-2xl bg-white dark:bg-neutral-950/20 max-w-lg mx-auto w-full my-auto shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-3">
                        <Inbox className="w-6 h-6 text-neutral-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">No tasks here</h3>
                    <p className="text-xs text-neutral-500 max-w-xs">
                        All clear! You don&apos;t have any tasks in this view. Use the NLP quick-add bar at the bottom to create one.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map(group => {
                        const collapsed = collapsedSections[group.sectionId];
                        const count = group.tasks.length;

                        // Beautiful border/bg coloring based on section
                        const sectionColors: Record<string, { bg: string; text: string; dot: string }> = {
                            'sec-planning':  { bg: 'bg-blue-50/50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
                            'sec-execution': { bg: 'bg-orange-50/50 dark:bg-orange-900/10', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
                            'sec-review':    { bg: 'bg-purple-50/50 dark:bg-purple-900/10', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
                            'sec-admin':     { bg: 'bg-gray-50/50 dark:bg-gray-900/10', text: 'text-gray-700 dark:text-gray-400', dot: 'bg-gray-500' },
                        };

                        const colors = sectionColors[group.sectionId] || { bg: 'bg-neutral-50/50 dark:bg-neutral-800/10', text: 'text-neutral-700 dark:text-neutral-400', dot: 'bg-neutral-400' };

                        return (
                            <div
                                key={group.sectionId}
                                className={`rounded-xl border border-neutral-100 dark:border-white/5 bg-white dark:bg-neutral-950 overflow-hidden transition-all duration-100 shadow-sm`}
                            >
                                {/* Section Header */}
                                <div
                                    onClick={() => toggleSection(group.sectionId)}
                                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 select-none border-b border-neutral-100 dark:border-white/5 ${colors.bg}`}
                                >
                                    {collapsed ? (
                                        <ChevronRight className="w-4 h-4 text-neutral-400" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                                    )}
                                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                                        {group.sectionName}
                                    </span>
                                    <span className="text-[10px] bg-neutral-200/60 dark:bg-white/10 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">
                                        {count}
                                    </span>
                                </div>

                                {/* Section Tasks */}
                                {!collapsed && (
                                    <div className="p-2 space-y-1">
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
