"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Page, PropertyValue } from '@/components/admin/database/types';
import { useTranslations } from 'next-intl';
import {
    Check,
    Calendar,
    Flag,
    Sun,
    Plus,
    Clock,
    RotateCcw,
    Send,
    X,
    AlertCircle,
    CheckCircle2,
    ListTodo
} from 'lucide-react';
import { parseRecurrenceRule, getNextDueDate } from '@/components/admin/tasks/RecurrenceEngine';

function getLocalDateStr(d = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isPersonalTask(p: Page): boolean {
    const project = p.properties['prop-task-project'];
    if (!project) return true;
    if (Array.isArray(project)) return project.length === 0;
    return false;
}

function isDoneTask(p: Page): boolean {
    const status = p.properties['prop-task-status'];
    return status === 't-done' || status === 'opt-done';
}

interface PendingUndo {
    pageId: string;
    previousStatus: PropertyValue;
    previousCompletedAt: PropertyValue;
    recurringPageId?: string;
    timerId: NodeJS.Timeout;
}

export default function MobileTasksPage() {
    const t = useTranslations('Mobile');
    const { resolveDbId } = useTenant();
    const tasksDbId = resolveDbId('db-tasks');

    // Store selectors
    const databases = useDatabaseStore(s => s.databases);
    const syncQueue = useDatabaseStore(s => s.syncQueue || []);
    const createPage = useDatabaseStore(s => s.createPage);
    const updatePageProperty = useDatabaseStore(s => s.updatePageProperty);
    const deletePage = useDatabaseStore(s => s.deletePage);

    // Reactive database lookup
    const db = useMemo(() => databases.find(d => d.id === tasksDbId), [databases, tasksDbId]);
    const allPages = useMemo(() => db?.pages || [], [db?.pages]);

    // Active tab: 'today' (landing view) or 'all'
    const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');

    // Fast Capture state
    const [captureOpen, setCaptureOpen] = useState(false);
    const [captureTitle, setCaptureTitle] = useState('');
    const captureInputRef = useRef<HTMLInputElement>(null);

    // Pending 4-second Undo state for 1-tap completions
    const [pendingUndos, setPendingUndos] = useState<Record<string, PendingUndo>>({});

    // Set of IDs currently pending sync to server
    const pendingSyncIds = useMemo(() => new Set(syncQueue.map(e => e.pageId)), [syncQueue]);

    const todayStr = useMemo(() => getLocalDateStr(), []);

    // Filter personal tasks
    const personalPages = useMemo(() => allPages.filter(isPersonalTask), [allPages]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            Object.values(pendingUndos).forEach(u => clearTimeout(u.timerId));
        };
    }, [pendingUndos]);

    // One-thumb Complete handler
    const handleToggleComplete = useCallback((page: Page) => {
        const isCurrentlyDone = isDoneTask(page);

        // If already completing/done, do nothing or re-open
        if (isCurrentlyDone && !pendingUndos[page.id]) {
            updatePageProperty(tasksDbId, page.id, 'prop-task-status', 't-todo');
            updatePageProperty(tasksDbId, page.id, 'prop-task-completed-at', '');
            return;
        }

        const prevStatus = (page.properties['prop-task-status'] as PropertyValue) || 't-todo';
        const prevCompletedAt = (page.properties['prop-task-completed-at'] as PropertyValue) || '';

        // Immediate store mutation
        updatePageProperty(tasksDbId, page.id, 'prop-task-status', 't-done');
        updatePageProperty(tasksDbId, page.id, 'prop-task-completed-at', new Date().toISOString());

        // Handle recurring tasks: create next occurrence
        let createdRecurringPageId: string | undefined;
        const recurStr = page.properties['prop-task-recurrence'] as string | undefined;
        if (recurStr?.trim()) {
            const parsed = parseRecurrenceRule(recurStr);
            if (parsed.ok) {
                const baseDueStr = page.properties['prop-task-due'] as string | undefined;
                const baseDueDate = baseDueStr ? new Date(baseDueStr) : new Date();
                const nextDueDate = getNextDueDate(parsed, baseDueDate, { completionDate: new Date() });
                const nextDueStr = getLocalDateStr(nextDueDate);

                const newPage = createPage(tasksDbId, {
                    ...page.properties,
                    'prop-task-status': 't-todo',
                    'prop-task-completed-at': '',
                    'prop-task-my-day': false,
                    'prop-task-due': nextDueStr,
                });
                createdRecurringPageId = newPage.id;
            }
        }

        // Setup 4-second Undo window
        const timerId = setTimeout(() => {
            setPendingUndos(current => {
                const next = { ...current };
                delete next[page.id];
                return next;
            });
        }, 4000);

        setPendingUndos(current => ({
            ...current,
            [page.id]: {
                pageId: page.id,
                previousStatus: prevStatus,
                previousCompletedAt: prevCompletedAt,
                recurringPageId: createdRecurringPageId,
                timerId,
            }
        }));
    }, [tasksDbId, updatePageProperty, createPage, pendingUndos]);

    // Undo handler
    const handleUndo = useCallback((pageId: string) => {
        const entry = pendingUndos[pageId];
        if (!entry) return;

        clearTimeout(entry.timerId);

        // Revert page properties
        updatePageProperty(tasksDbId, pageId, 'prop-task-status', entry.previousStatus);
        updatePageProperty(tasksDbId, pageId, 'prop-task-completed-at', entry.previousCompletedAt);

        // Remove created recurring page if any
        if (entry.recurringPageId) {
            deletePage(tasksDbId, entry.recurringPageId);
        }

        setPendingUndos(current => {
            const next = { ...current };
            delete next[pageId];
            return next;
        });
    }, [pendingUndos, tasksDbId, updatePageProperty, deletePage]);

    // Fast capture submit handler
    const handleCaptureSubmit = useCallback((e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = captureTitle.trim();
        if (!trimmed) return;

        // Create page with specified defaults: title, t-todo, my-day: true
        createPage(tasksDbId, {
            title: trimmed,
            'prop-task-status': 't-todo',
            'prop-task-my-day': true,
        });

        // Clear input and keep focus for rapid consecutive captures
        setCaptureTitle('');
        if (captureInputRef.current) {
            captureInputRef.current.focus();
        }
    }, [captureTitle, createPage, tasksDbId]);

    // Visible tasks calculation
    const visibleTasks = useMemo(() => {
        return personalPages.filter(page => {
            const isCompleted = isDoneTask(page);
            const isPendingUndo = Boolean(pendingUndos[page.id]);

            // Exclude completed unless in the 4-second undo grace period
            if (isCompleted && !isPendingUndo) return false;

            if (activeTab === 'today') {
                const due = page.properties['prop-task-due'] as string | undefined;
                const myDay = Boolean(page.properties['prop-task-my-day']);
                const flagged = Boolean(page.properties['prop-task-flagged']);
                const isOverdueOrDueToday = Boolean(due && due <= todayStr);
                return isOverdueOrDueToday || myDay || flagged;
            }

            return true;
        }).sort((a, b) => {
            const aDue = (a.properties['prop-task-due'] as string | undefined) || '';
            const bDue = (b.properties['prop-task-due'] as string | undefined) || '';
            const aOverdue = Boolean(aDue && aDue < todayStr);
            const bOverdue = Boolean(bDue && bDue < todayStr);

            // Overdue sorts first
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            // If both overdue, sort earliest first
            if (aOverdue && bOverdue) {
                return aDue.localeCompare(bDue);
            }

            // Both not overdue: items with due date sort before items without
            if (aDue && !bDue) return -1;
            if (!aDue && bDue) return 1;
            if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);

            // Otherwise, sort by creation descending
            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            return bTime - aTime;
        });
    }, [personalPages, pendingUndos, activeTab, todayStr]);

    // Count today's tasks
    const todayCount = useMemo(() => {
        return personalPages.filter(p => {
            if (isDoneTask(p) && !pendingUndos[p.id]) return false;
            const due = p.properties['prop-task-due'] as string | undefined;
            const myDay = Boolean(p.properties['prop-task-my-day']);
            const flagged = Boolean(p.properties['prop-task-flagged']);
            return (due && due <= todayStr) || myDay || flagged;
        }).length;
    }, [personalPages, pendingUndos, todayStr]);

    const allCount = useMemo(() => {
        return personalPages.filter(p => !isDoneTask(p) || Boolean(pendingUndos[p.id])).length;
    }, [personalPages, pendingUndos]);

    return (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4 relative min-h-[calc(100dvh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black tracking-tight">{t('tasks_title')}</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                        {t('tasks_subtitle')}
                    </p>
                </div>
            </div>

            {/* Tab Switcher: Today (default) vs All Open */}
            <div className="flex gap-1 bg-neutral-200/60 dark:bg-white/5 p-1 rounded-xl">
                <button
                    type="button"
                    onClick={() => setActiveTab('today')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
                        activeTab === 'today'
                            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>{t('tasks_tab_today')}</span>
                    {todayCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-neutral-300">
                            {todayCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
                        activeTab === 'all'
                            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    <ListTodo className="w-4 h-4" />
                    <span>{t('tasks_tab_all')}</span>
                    {allCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-neutral-300">
                            {allCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Task List */}
            {visibleTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-3">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500/80" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        {activeTab === 'today' ? t('tasks_empty_today') : t('tasks_empty_all')}
                    </p>
                </div>
            ) : (
                <div className="space-y-2 pb-28">
                    <div className="divide-y divide-neutral-100 dark:divide-white/5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 overflow-hidden shadow-sm">
                        {visibleTasks.map(task => {
                            const title = (task.properties['title'] as string) || 'Untitled Task';
                            const due = task.properties['prop-task-due'] as string | undefined;
                            const isMyDay = Boolean(task.properties['prop-task-my-day']);
                            const isFlagged = Boolean(task.properties['prop-task-flagged']);
                            const isOverdue = Boolean(due && due < todayStr);
                            const isPendingSync = pendingSyncIds.has(task.id);
                            const isCompleting = Boolean(pendingUndos[task.id]);

                            return (
                                <div
                                    key={task.id}
                                    className={`flex items-center justify-between p-3.5 transition-all ${
                                        isCompleting
                                            ? 'bg-neutral-50 dark:bg-neutral-800/60 opacity-80'
                                            : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30'
                                    }`}
                                >
                                    {/* 1-Tap Completion Checkbox (Min 44px Touch Target) */}
                                    <button
                                        type="button"
                                        onClick={() => handleToggleComplete(task)}
                                        className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1.5 mr-1"
                                        aria-label={isCompleting ? 'Completed' : 'Complete task'}
                                    >
                                        <div
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                isCompleting
                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                                    : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-400'
                                            }`}
                                        >
                                            {isCompleting && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </div>
                                    </button>

                                    {/* Task Content */}
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p
                                            className={`text-sm font-semibold tracking-tight transition-all leading-snug ${
                                                isCompleting
                                                    ? 'line-through text-neutral-400 dark:text-neutral-500'
                                                    : 'text-neutral-900 dark:text-neutral-100'
                                            }`}
                                        >
                                            {title}
                                        </p>

                                        {/* Badges / Metadata */}
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                                            {/* Overdue badge */}
                                            {isOverdue && (
                                                <span className="flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {t('tasks_overdue')} {due}
                                                </span>
                                            )}

                                            {/* Due date (not overdue) */}
                                            {!isOverdue && due && (
                                                <span className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                                                    <Calendar className="w-3 h-3" />
                                                    {due === todayStr ? t('tasks_tab_today') : due}
                                                </span>
                                            )}

                                            {/* My Day */}
                                            {isMyDay && (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                                                    <Sun className="w-2.5 h-2.5" />
                                                    {t('tasks_my_day')}
                                                </span>
                                            )}

                                            {/* Flagged */}
                                            {isFlagged && (
                                                <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-semibold">
                                                    <Flag className="w-2.5 h-2.5 fill-current" />
                                                    {t('tasks_flagged')}
                                                </span>
                                            )}

                                            {/* Warm-Offline Pending Sync indicator */}
                                            {isPendingSync && (
                                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                                                    <Clock className="w-2.5 h-2.5 animate-pulse" />
                                                    {t('tasks_pending_sync')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4-Second Undo Button (Min 44px Touch Target) */}
                                    {isCompleting && (
                                        <button
                                            type="button"
                                            onClick={() => handleUndo(task.id)}
                                            className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>{t('tasks_undo')}</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Persistent Thumb Quick Capture Bar (Bottom-Right, Above Nav) ── */}
            {captureOpen ? (
                <div className="fixed bottom-20 inset-x-4 max-w-lg mx-auto z-40">
                    <form
                        onSubmit={handleCaptureSubmit}
                        className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-2xl p-2 shadow-2xl flex items-center gap-2 ring-2 ring-black/5 dark:ring-white/10"
                    >
                        <input
                            ref={captureInputRef}
                            type="text"
                            value={captureTitle}
                            onChange={e => setCaptureTitle(e.target.value)}
                            placeholder={t('tasks_capture_placeholder')}
                            autoFocus
                            className="flex-1 bg-transparent px-3 py-2 text-sm font-semibold outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400"
                        />
                        <button
                            type="submit"
                            disabled={!captureTitle.trim()}
                            className="min-w-[44px] min-h-[44px] rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-40 transition-all active:scale-95"
                            aria-label="Save task"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCaptureOpen(false)}
                            className="min-w-[44px] min-h-[44px] rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center justify-center transition-all"
                            aria-label="Close capture"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            ) : (
                <div className="fixed bottom-20 right-4 z-40">
                    <button
                        type="button"
                        onClick={() => {
                            setCaptureOpen(true);
                            setTimeout(() => captureInputRef.current?.focus(), 50);
                        }}
                        className="w-14 h-14 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                        aria-label="Quick capture task"
                    >
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                </div>
            )}
        </div>
    );
}
