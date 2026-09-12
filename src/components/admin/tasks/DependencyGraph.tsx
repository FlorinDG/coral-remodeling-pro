'use client';

import React, { useState, useMemo } from 'react';
import type { Page } from '@/components/admin/database/types';
import { Network, Link2, AlertTriangle, CheckCircle2, ChevronRight, Plus, X, AlertCircle } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useTenant } from '@/context/TenantContext';
import {
    validateDependencyCycle,
    getTaskDependencies,
    getTaskDependents,
} from './DependencyEngine';

interface DependencyGraphProps {
    pages: Page[];
    onPageClick: (page: Page) => void;
}

export function DependencyGraph({ pages, onPageClick }: DependencyGraphProps) {
    const { resolveDbId } = useTenant();
    const tasksDbId = resolveDbId('db-tasks');
    const updatePageProperty = useDatabaseStore(s => s.updatePageProperty);

    const activePages = useMemo(() => {
        return pages.filter(p => {
            const s = p.properties['prop-task-status'] as string;
            return s !== 'opt-done' && s !== 'opt-dropped' && s !== 't-done';
        });
    }, [pages]);

    // Track cycle rejection message if user attempted an invalid cycle
    const [cycleError, setCycleError] = useState<string | null>(null);
    const [showAddPicker, setShowAddPicker] = useState(false);

    // Selected task in the dependency graph
    const [selectedId, setSelectedId] = useState<string | null>(
        activePages.find(p => {
            const deps = p.properties['prop-task-depends-on'] as string[] | undefined;
            return Array.isArray(deps) && deps.length > 0;
        })?.id || activePages[0]?.id || null
    );

    const currentTask = useMemo(() => {
        return pages.find(p => p.id === selectedId) || null;
    }, [pages, selectedId]);

    // Use DependencyEngine for referential integrity and cycle-safe dependency resolution
    const currentTaskDeps = useMemo(() => {
        if (!currentTask) {
            return {
                prerequisites: [],
                danglingPrerequisiteIds: [],
                isBlocked: false,
                openPrerequisites: [],
                hasMissingBlocker: false,
            };
        }
        return getTaskDependencies(currentTask, pages);
    }, [currentTask, pages]);

    // Tasks unlocked next by currentTask (dependents)
    const dependents = useMemo(() => {
        if (!currentTask) return [];
        return getTaskDependents(currentTask.id, activePages);
    }, [currentTask, activePages]);

    const isPrereqCompleted = (page: Page) => {
        const s = page.properties['prop-task-status'] as string;
        return s === 'opt-done' || s === 't-done';
    };

    // Candidate tasks that can be added as prerequisites (excluding self and existing)
    const availablePrereqCandidates = useMemo(() => {
        if (!currentTask) return [];
        const existingDeps = new Set((currentTask.properties['prop-task-depends-on'] as string[] | undefined) || []);
        return activePages.filter(p => p.id !== currentTask.id && !existingDeps.has(p.id));
    }, [currentTask, activePages]);

    // Add prerequisite with DEP-2 cycle validation
    const handleAddPrerequisite = (candidateId: string) => {
        if (!currentTask) return;

        setCycleError(null);
        const validation = validateDependencyCycle(currentTask.id, candidateId, pages);

        if (!validation.ok) {
            // Refused at edit time, naming the path (DEP-2)
            setCycleError(validation.reason || 'Circular dependency detected.');
            return;
        }

        const currentDeps = (currentTask.properties['prop-task-depends-on'] as string[] | undefined) || [];
        const updatedDeps = [...currentDeps, candidateId];
        updatePageProperty(tasksDbId, currentTask.id, 'prop-task-depends-on', updatedDeps);
        setShowAddPicker(false);
    };

    // Remove prerequisite
    const handleRemovePrerequisite = (prereqId: string) => {
        if (!currentTask) return;
        setCycleError(null);
        const currentDeps = (currentTask.properties['prop-task-depends-on'] as string[] | undefined) || [];
        const updatedDeps = currentDeps.filter(id => id !== prereqId);
        updatePageProperty(tasksDbId, currentTask.id, 'prop-task-depends-on', updatedDeps);
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-neutral-50/50 dark:bg-neutral-900/10 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-white/10 select-none">
            {/* Left sidebar: Task selector list */}
            <div className="w-full md:w-80 flex flex-col min-h-0 bg-white dark:bg-neutral-950">
                <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Network className="w-5 h-5 text-indigo-500" />
                        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Sequence Flows</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {activePages.map(page => {
                        const depsInfo = getTaskDependencies(page, pages);
                        const active = page.id === selectedId;

                        return (
                            <button
                                key={page.id}
                                onClick={() => {
                                    setSelectedId(page.id);
                                    setCycleError(null);
                                    setShowAddPicker(false);
                                }}
                                className={`w-full flex items-center justify-between text-left p-2.5 rounded-xl transition-all
                                    ${active
                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-semibold'
                                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <span className="truncate text-xs flex-1 pr-2">
                                    {(page.properties['title'] as string) || 'Untitled'}
                                </span>
                                {depsInfo.isBlocked && (
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
                {/* Cycle Error Banner (DEP-2 refusal) */}
                {cycleError && (
                    <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2 shadow-sm">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-bold">Dependency Refused</p>
                                <p className="mt-0.5 text-[11px] leading-relaxed">{cycleError}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setCycleError(null)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                            <X className="w-3.5 h-3.5 text-red-500" />
                        </button>
                    </div>
                )}

                {currentTask ? (
                    <div className="space-y-8 my-auto">
                        <div className="text-center max-w-lg mx-auto">
                            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-1">Task Sequence & Order</h3>
                            <h2 className="text-lg font-bold text-neutral-800 dark:text-white truncate">
                                {(currentTask.properties['title'] as string) || 'Untitled'}
                            </h2>
                        </div>

                        {/* FLOW MAP DESIGN */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start justify-center max-w-4xl mx-auto w-full relative">
                            {/* Column 1: Prerequisites (Must Do First) */}
                            <div className="space-y-3 bg-neutral-100/50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 p-4 rounded-2xl min-h-[160px] flex flex-col justify-start">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1">
                                        Prerequisites (Must Do First)
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPicker(v => !v)}
                                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/30"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Add
                                    </button>
                                </div>

                                {/* Add Prerequisite Dropdown */}
                                {showAddPicker && (
                                    <div className="p-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl space-y-1 shadow-lg text-xs">
                                        <p className="text-[10px] text-neutral-400 font-semibold px-1">Select prerequisite:</p>
                                        {availablePrereqCandidates.length === 0 ? (
                                            <p className="text-[11px] text-neutral-400 italic px-1 py-1">No other active tasks available</p>
                                        ) : (
                                            <div className="max-h-40 overflow-y-auto space-y-0.5">
                                                {availablePrereqCandidates.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => handleAddPrerequisite(c.id)}
                                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-white/5 truncate flex items-center justify-between"
                                                    >
                                                        <span className="truncate">{(c.properties['title'] as string) || 'Untitled'}</span>
                                                        <Plus className="w-3 h-3 text-neutral-400 shrink-0 ml-1" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Resolved Prerequisites */}
                                {currentTaskDeps.prerequisites.length > 0 ? (
                                    currentTaskDeps.prerequisites.map(p => {
                                        const done = isPrereqCompleted(p);
                                        return (
                                            <div
                                                key={p.id}
                                                className={`p-2.5 bg-white dark:bg-neutral-900 border rounded-xl text-xs flex items-center justify-between transition-colors
                                                    ${done
                                                        ? 'border-green-200 dark:border-green-950 text-neutral-400'
                                                        : 'border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200'
                                                    }`}
                                            >
                                                <span
                                                    onClick={() => onPageClick(p)}
                                                    className="truncate pr-2 font-medium flex-1 cursor-pointer hover:underline"
                                                >
                                                    {(p.properties['title'] as string) || 'Untitled'}
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {done ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                    ) : (
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePrerequisite(p.id)}
                                                        className="text-neutral-400 hover:text-red-500 p-0.5"
                                                        title="Remove prerequisite"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : currentTaskDeps.danglingPrerequisiteIds.length === 0 ? (
                                    <p className="text-xs text-neutral-400 text-center italic py-4">No prerequisites</p>
                                ) : null}

                                {/* Dangling / Missing Prerequisite IDs (DEP-1 / D-3 Referential Integrity Reporting) */}
                                {currentTaskDeps.danglingPrerequisiteIds.map(missingId => (
                                    <div
                                        key={missingId}
                                        className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl text-xs flex items-center justify-between text-red-700 dark:text-red-400"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                            <span className="truncate font-medium">Deleted blocker [{missingId.slice(0, 8)}]</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemovePrerequisite(missingId)}
                                            className="text-[10px] bg-red-100 hover:bg-red-200 dark:bg-red-900/40 px-2 py-0.5 rounded font-bold ml-2 shrink-0"
                                            title="Clear broken reference"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Arrow Connection 1 (Desktop only) */}
                            <div className="hidden lg:block absolute left-[31.5%] top-[40%] w-[4%] h-[2px] bg-gradient-to-r from-neutral-300 to-indigo-400" />

                            {/* Column 2: Target Task (Selected) */}
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-400 dark:border-indigo-600 p-5 rounded-2xl shadow-xl flex flex-col justify-center min-h-[180px] relative">
                                <span className="absolute top-3 right-3 text-[9px] uppercase font-extrabold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                                    Current Task
                                </span>
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white pr-10 mb-2 line-clamp-3">
                                    {(currentTask.properties['title'] as string) || 'Untitled'}
                                </h4>

                                {/* Informational Blocked Surfacing (Florin: blocked tasks must surface and not be buried) */}
                                {currentTaskDeps.hasMissingBlocker ? (
                                    <div className="text-[10px] text-red-700 bg-red-500/10 px-2 py-1 rounded-lg flex items-center gap-1 mt-2">
                                        <AlertCircle className="w-3 h-3 flex-shrink-0 text-red-500" />
                                        Blocked by deleted/missing task reference
                                    </div>
                                ) : currentTaskDeps.openPrerequisites.length > 0 ? (
                                    <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg flex items-center gap-1 mt-2">
                                        <AlertTriangle className="w-3 h-3 flex-shrink-0 text-amber-500" />
                                        Blocked by {currentTaskDeps.openPrerequisites.length} incomplete {currentTaskDeps.openPrerequisites.length === 1 ? 'prerequisite' : 'prerequisites'}
                                    </div>
                                ) : currentTaskDeps.prerequisites.length > 0 ? (
                                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg flex items-center gap-1 mt-2">
                                        <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                                        All prerequisites completed — Ready to proceed
                                    </div>
                                ) : null}
                            </div>

                            {/* Arrow Connection 2 (Desktop only) */}
                            <div className="hidden lg:block absolute right-[31.5%] top-[40%] w-[4%] h-[2px] bg-gradient-to-r from-indigo-400 to-neutral-300" />

                            {/* Column 3: Dependents (Renamed: Unlocks Next, no misleading "Deferred Flow") */}
                            <div className="space-y-3 bg-neutral-100/50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 p-4 rounded-2xl min-h-[160px] flex flex-col justify-start">
                                <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-2 text-center">
                                    Unlocks Next
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
