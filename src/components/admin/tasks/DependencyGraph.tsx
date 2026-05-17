'use client';

import { useState } from 'react';
import { Page } from '@/components/admin/database/types';
import { Network, Link2, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { PRIORITY_CONFIG } from './TaskRow';

interface DependencyGraphProps {
    pages: Page[];
    onPageClick: (page: Page) => void;
}

export function DependencyGraph({ pages, onPageClick }: DependencyGraphProps) {
    const activePages = pages.filter(p => {
        const s = p.properties['prop-task-status'] as string;
        return s !== 'opt-done' && s !== 'opt-dropped';
    });

    // Find tasks that have dependencies (Blocked Tasks) or block others (Prerequisites)
    const [selectedId, setSelectedId] = useState<string | null>(
        activePages.find(p => {
            const deps = p.properties['prop-task-depends-on'] as string[] | undefined;
            return Array.isArray(deps) && deps.length > 0;
        })?.id || activePages[0]?.id || null
    );

    const currentTask = activePages.find(p => p.id === selectedId);

    // Dependencies of the current task (Prerequisites)
    const prerequisites = currentTask
        ? (currentTask.properties['prop-task-depends-on'] as string[] || [])
            .map(id => pages.find(p => p.id === id))
            .filter((p): p is Page => !!p)
        : [];

    // Tasks that depend on the current task (Dependents)
    const dependents = currentTask
        ? activePages.filter(p => {
            const deps = p.properties['prop-task-depends-on'] as string[] | undefined;
            return Array.isArray(deps) && deps.includes(currentTask.id);
        })
        : [];

    const isPrereqCompleted = (page: Page) => {
        const s = page.properties['prop-task-status'] as string;
        return s === 'opt-done';
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-neutral-50/50 dark:bg-neutral-900/10 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-white/10 select-none">
            {/* Left sidebar: Task selector list */}
            <div className="w-full md:w-80 flex flex-col min-h-0 bg-white dark:bg-neutral-950">
                <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center gap-2">
                    <Network className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Task Dependency Flows</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {activePages.map(page => {
                        const deps = page.properties['prop-task-depends-on'] as string[] | undefined;
                        const hasDeps = Array.isArray(deps) && deps.length > 0;
                        const active = page.id === selectedId;

                        return (
                            <button
                                key={page.id}
                                onClick={() => setSelectedId(page.id)}
                                className={`w-full flex items-center justify-between text-left p-2.5 rounded-xl transition-all
                                    ${active
                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-semibold'
                                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <span className="truncate text-xs flex-1 pr-2">
                                    {(page.properties['title'] as string) || 'Untitled'}
                                </span>
                                {hasDeps && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 flex-shrink-0">
                                        <Link2 className="w-2.5 h-2.5" />
                                        Blocked
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right: Flow visualization & Details */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
                {currentTask ? (
                    <div className="space-y-8 my-auto">
                        <div className="text-center max-w-lg mx-auto">
                            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-1">Visual sequence path</h3>
                            <h2 className="text-lg font-bold text-neutral-800 dark:text-white truncate">
                                {(currentTask.properties['title'] as string) || 'Untitled'}
                            </h2>
                        </div>

                        {/* FLOW MAP DESIGN */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center justify-center max-w-4xl mx-auto w-full relative">
                            {/* Column 1: Prerequisites */}
                            <div className="space-y-3 bg-neutral-100/50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 p-4 rounded-2xl min-h-[160px] flex flex-col justify-center">
                                <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-2 text-center flex items-center justify-center gap-1">
                                    Prerequisites (Must Do First)
                                </h4>
                                {prerequisites.length > 0 ? (
                                    prerequisites.map(p => {
                                        const done = isPrereqCompleted(p);
                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => onPageClick(p)}
                                                className={`p-2.5 bg-white dark:bg-neutral-900 border rounded-xl text-xs flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-colors
                                                    ${done
                                                        ? 'border-green-200 dark:border-green-950 text-neutral-400'
                                                        : 'border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200'
                                                    }`}
                                            >
                                                <span className="truncate pr-2 font-medium flex-1">
                                                    {(p.properties['title'] as string) || 'Untitled'}
                                                </span>
                                                {done ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-neutral-400 text-center italic py-4">No prerequisites</p>
                                )}
                            </div>

                            {/* Arrow Connection 1 (Desktop only) */}
                            <div className="hidden lg:block absolute left-[31.5%] w-[4%] h-[2px] bg-gradient-to-r from-neutral-300 to-indigo-400" />

                            {/* Column 2: Target Task (Selected) */}
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-400 dark:border-indigo-600 p-5 rounded-2xl shadow-xl flex flex-col justify-center min-h-[180px] relative">
                                <span className="absolute top-3 right-3 text-[9px] uppercase font-extrabold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                                    Current Task
                                </span>
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white pr-10 mb-2 line-clamp-3">
                                    {(currentTask.properties['title'] as string) || 'Untitled'}
                                </h4>
                                {prerequisites.some(p => !isPrereqCompleted(p)) && (
                                    <div className="text-[10px] text-amber-600 bg-amber-500/10 px-2 py-1 rounded-lg flex items-center gap-1 mt-2">
                                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                        Blocked by incomplete prerequisites
                                    </div>
                                )}
                            </div>

                            {/* Arrow Connection 2 (Desktop only) */}
                            <div className="hidden lg:block absolute right-[31.5%] w-[4%] h-[2px] bg-gradient-to-r from-indigo-400 to-neutral-300" />

                            {/* Column 3: Dependents */}
                            <div className="space-y-3 bg-neutral-100/50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 p-4 rounded-2xl min-h-[160px] flex flex-col justify-center">
                                <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-2 text-center">
                                    Unlocks Next (Deferred Flow)
                                </h4>
                                {dependents.length > 0 ? (
                                    dependents.map(d => (
                                        <div
                                            key={d.id}
                                            onClick={() => onPageClick(d)}
                                            className="p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl text-xs flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-colors text-neutral-700 dark:text-neutral-200"
                                        >
                                            <span className="truncate pr-2 font-medium flex-1">
                                                {(d.properties['title'] as string) || 'Untitled'}
                                            </span>
                                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-neutral-400 text-center italic py-4">No dependent tasks</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 italic">
                        Select a task to view its dependency flows
                    </div>
                )}
            </div>
        </div>
    );
}
