'use client';

import { Page } from '@/components/admin/database/types';
import { STATUS_CONFIG, PRIORITY_CONFIG, getDueDateDisplay } from './TaskRow';

interface TaskBoardViewProps {
    pages: Page[];
    onUpdateStatus: (pageId: string, status: string) => void;
    onPageClick: (page: Page) => void;
}

export function TaskBoardView({ pages, onUpdateStatus, onPageClick }: TaskBoardViewProps) {
    const activeTasks = pages.filter(p => {
        const s = p.properties['prop-task-status'] as string;
        return s !== 'opt-dropped';
    });

    const columns = Object.entries(STATUS_CONFIG).filter(([id]) => id !== 'opt-dropped');

    // HTML5 Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, pageId: string) => {
        e.dataTransfer.setData('text/plain', pageId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        const pageId = e.dataTransfer.getData('text/plain');
        if (pageId) {
            onUpdateStatus(pageId, targetStatus);
        }
    };

    return (
        <div className="flex-1 flex gap-4 p-4 lg:p-6 overflow-x-auto min-h-0 bg-neutral-100/30 dark:bg-neutral-950/20">
            {columns.map(([statusId, cfg]) => {
                const columnTasks = activeTasks.filter(
                    p => (p.properties['prop-task-status'] as string || 'opt-todo') === statusId
                );

                return (
                    <div
                        key={statusId}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, statusId)}
                        className="flex-shrink-0 w-80 flex flex-col bg-neutral-200/50 dark:bg-neutral-900/60 rounded-2xl border border-neutral-300 dark:border-white/20 p-3 min-h-0 shadow-md"
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-3.5 px-1.5 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-neutral-950 dark:text-neutral-100 uppercase tracking-widest">
                                    {cfg.label}
                                </span>
                                <span className="text-xs bg-neutral-350 dark:bg-white/15 text-neutral-900 dark:text-neutral-200 px-2 py-0.5 rounded-full font-bold border border-neutral-405/20 shadow-sm">
                                    {columnTasks.length}
                                </span>
                            </div>
                        </div>

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[150px]">
                            {columnTasks.map(page => {
                                const props = page.properties;
                                const priority = props['prop-task-priority'] as string | undefined;
                                const due = props['prop-task-due'] as string | undefined;
                                const tags = (props['prop-task-tags'] as string[]) || [];

                                const priorityCfg = priority ? PRIORITY_CONFIG[priority] : null;
                                const dueCfg = getDueDateDisplay(due);

                                return (
                                    <div
                                        key={page.id}
                                        draggable
                                        onDragStart={e => handleDragStart(e, page.id)}
                                        onClick={() => onPageClick(page)}
                                        className="group p-3.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-white/15 rounded-xl shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing hover:border-orange-350 dark:hover:border-orange-900/80 transition-all"
                                    >
                                        {/* Tags */}
                                        {tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2.5">
                                                {tags.slice(0, 2).map(t => (
                                                    <span key={t} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800/40 shadow-sm">
                                                        {t.replace('tag-', '#')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Title */}
                                        <h4 className="text-sm font-bold text-neutral-950 dark:text-neutral-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 mb-2.5">
                                            {(props['title'] as string) || 'Untitled'}
                                        </h4>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-250 dark:border-white/10">
                                            {/* Priority */}
                                            {priorityCfg ? (
                                                <span
                                                    className="font-black px-2 py-0.5 rounded border border-current shadow-sm"
                                                    style={{ color: priorityCfg.color, backgroundColor: priorityCfg.bg }}
                                                >
                                                    {priorityCfg.label}
                                                </span>
                                            ) : (
                                                <span />
                                            )}

                                            {/* Due Date */}
                                            {dueCfg.label && (
                                                <span className="font-bold bg-neutral-100/50 dark:bg-white/5 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/5 shadow-sm" style={{ color: dueCfg.color }}>
                                                    {dueCfg.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {columnTasks.length === 0 && (
                                <div className="h-28 border border-dashed border-neutral-350 dark:border-white/15 rounded-xl flex items-center justify-center text-xs font-bold text-neutral-500 bg-neutral-50/20 dark:bg-white/[0.01] select-none">
                                    Drag tasks here
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
