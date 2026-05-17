'use client';

import { useState } from 'react';
import { Page } from '@/components/admin/database/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './TaskRow';
import { CheckCircle2, ChevronRight, Inbox, Eye, ArrowRight } from 'lucide-react';

interface ReviewModeProps {
    pages: Page[];
    onUpdatePage: (pageId: string, props: Partial<Record<string, unknown>>) => void;
    onComplete: (page: Page) => void;
}

export function ReviewMode({ pages, onUpdatePage, onComplete }: ReviewModeProps) {
    const unreviewedTasks = pages.filter(p => {
        const s = p.properties['prop-task-status'] as string;
        const reviewed = p.properties['prop-task-reviewed-at'] as string;
        return s !== 'opt-done' && s !== 'opt-dropped' && !reviewed;
    });

    const [currentIndex, setCurrentIndex] = useState(0);

    const activeTask = unreviewedTasks[currentIndex];

    const handleMarkReviewed = () => {
        if (!activeTask) return;
        onUpdatePage(activeTask.id, {
            'prop-task-reviewed-at': new Date().toISOString(),
        });
        // Stay at same index since the current one is filtered out, but if it exceeds list, wrap or cap
        if (currentIndex >= unreviewedTasks.length - 1) {
            setCurrentIndex(Math.max(0, unreviewedTasks.length - 2));
        }
    };

    const handleSkip = () => {
        if (currentIndex < unreviewedTasks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCurrentIndex(0);
        }
    };

    if (unreviewedTasks.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-50/50 dark:bg-neutral-900/10 min-h-0 select-none">
                <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 flex items-center justify-center mb-4 shadow-sm border border-green-150">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Review Inbox Zero!</h3>
                <p className="text-sm text-neutral-500 max-w-sm">
                    All tasks have been processed and reviewed recently. Great job maintaining operational sanity!
                </p>
            </div>
        );
    }

    const props = activeTask.properties;
    const priority = props['prop-task-priority'] as string;
    const due = props['prop-task-due'] as string;
    const notes = props['prop-task-notes'] as string;
    const tags = (props['prop-task-tags'] as string[]) || [];

    const priorityCfg = priority ? PRIORITY_CONFIG[priority] : null;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-50/50 dark:bg-neutral-900/10 p-6">
            {/* Header / Tracker */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-500" />
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">GTD Review Mode</span>
                </div>
                <span className="text-xs font-bold text-neutral-500 bg-neutral-200 dark:bg-white/10 px-2.5 py-1 rounded-full">
                    {currentIndex + 1} of {unreviewedTasks.length} pending
                </span>
            </div>

            {/* Main Review Card */}
            <div className="flex-1 max-w-2xl w-full mx-auto bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-xl p-6 flex flex-col justify-between mb-6">
                <div className="space-y-6">
                    {/* Title */}
                    <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Task Title</span>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
                            {(props['title'] as string) || 'Untitled'}
                        </h2>
                    </div>

                    {/* Meta properties */}
                    <div className="grid grid-cols-2 gap-4 border-y border-neutral-100 dark:border-white/5 py-4">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Priority</span>
                            <div className="flex items-center gap-1.5 mt-1">
                                {priorityCfg ? (
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded"
                                        style={{ color: priorityCfg.color, backgroundColor: priorityCfg.bg }}
                                    >
                                        {priorityCfg.label}
                                    </span>
                                ) : (
                                    <span className="text-xs text-neutral-500">—</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Due Date</span>
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-1">
                                {due || 'No due date'}
                            </p>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Notes & Details</span>
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 p-4 rounded-xl mt-1.5 min-h-[100px] whitespace-pre-wrap">
                            {notes || 'No description or operational notes attached.'}
                        </p>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Tags</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {tags.map(t => (
                                    <span key={t} className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 font-bold">
                                        {t.replace('tag-', '#')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Interaction Actions */}
                <div className="flex items-center gap-3 pt-6 border-t border-neutral-150 mt-6">
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 text-sm font-semibold border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        onClick={() => {
                            onComplete(activeTask);
                            if (currentIndex >= unreviewedTasks.length - 1) {
                                setCurrentIndex(Math.max(0, unreviewedTasks.length - 2));
                            }
                        }}
                        className="flex-1 py-3 text-sm font-semibold border border-green-200 text-green-600 dark:border-green-900 dark:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                    >
                        Complete Task
                    </button>
                    <button
                        onClick={handleMarkReviewed}
                        className="flex-1 py-3 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                        Reviewed
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
