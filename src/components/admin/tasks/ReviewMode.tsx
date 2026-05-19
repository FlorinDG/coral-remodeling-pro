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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-100/30 dark:bg-neutral-950/20 min-h-0 select-none">
                <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 flex items-center justify-center mb-4 shadow-md border border-green-300">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white mb-2">Review Inbox Zero!</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm font-semibold">
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
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-100/30 dark:bg-neutral-950/20 p-6">
            {/* Header / Tracker */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-650" />
                    <span className="text-sm font-black text-neutral-850 dark:text-neutral-100 uppercase tracking-widest">GTD Review Mode</span>
                </div>
                <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 bg-neutral-200 dark:bg-white/15 px-3 py-1 rounded-full border border-neutral-300 dark:border-white/10 shadow-sm">
                    {currentIndex + 1} of {unreviewedTasks.length} pending
                </span>
            </div>

            {/* Main Review Card */}
            <div className="flex-1 max-w-2xl w-full mx-auto bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-white/20 rounded-2xl shadow-xl p-6 flex flex-col justify-between mb-6">
                <div className="space-y-6">
                    {/* Title */}
                    <div>
                        <span className="text-[10px] uppercase font-black text-neutral-500 dark:text-neutral-400 tracking-wider">Task Title</span>
                        <h2 className="text-xl font-black text-neutral-950 dark:text-white mt-1">
                            {(props['title'] as string) || 'Untitled'}
                        </h2>
                    </div>

                    {/* Meta properties */}
                    <div className="grid grid-cols-2 gap-4 border-y border-neutral-250 dark:border-white/10 py-4">
                        <div>
                            <span className="text-[10px] uppercase font-black text-neutral-500 dark:text-neutral-400 tracking-wider">Priority</span>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                {priorityCfg ? (
                                    <span
                                        className="text-xs font-black px-2.5 py-0.5 rounded border border-current"
                                        style={{ color: priorityCfg.color, backgroundColor: priorityCfg.bg }}
                                    >
                                        {priorityCfg.label}
                                    </span>
                                ) : (
                                    <span className="text-xs text-neutral-600 dark:text-neutral-405">—</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-black text-neutral-500 dark:text-neutral-400 tracking-wider">Due Date</span>
                            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1.5">
                                {due || 'No due date'}
                            </p>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <span className="text-[10px] uppercase font-black text-neutral-500 dark:text-neutral-400 tracking-wider">Notes & Details</span>
                        <p className="text-sm text-neutral-805 dark:text-neutral-300 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-300 dark:border-white/10 p-4 rounded-xl mt-2 min-h-[100px] whitespace-pre-wrap font-semibold">
                            {notes || 'No description or operational notes attached.'}
                        </p>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div>
                            <span className="text-[10px] uppercase font-black text-neutral-500 dark:text-neutral-400 tracking-wider">Tags</span>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {tags.map(t => (
                                    <span key={t} className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800/35 font-bold shadow-sm">
                                        {t.replace('tag-', '#')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Interaction Actions */}
                <div className="flex items-center gap-3 pt-6 border-t border-neutral-250 dark:border-white/10 mt-6">
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 text-sm font-black border border-neutral-300 dark:border-white/20 text-neutral-800 dark:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors shadow-sm"
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
                        className="flex-1 py-3 text-sm font-black border border-green-300 text-green-700 dark:border-green-800 dark:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors shadow-sm"
                    >
                        Complete Task
                    </button>
                    <button
                        onClick={handleMarkReviewed}
                        className="flex-1 py-3 text-sm font-black bg-orange-500 hover:bg-orange-655 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                        Reviewed
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
