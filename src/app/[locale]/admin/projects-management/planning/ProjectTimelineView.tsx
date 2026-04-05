"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Calendar as CalendarIcon, Clock, ChevronRight, Activity } from 'lucide-react';
import { differenceInDays, addDays, startOfMonth, endOfMonth, eachMonthOfInterval, format } from 'date-fns';

export default function ProjectTimelineView() {
    const database = useDatabaseStore(state => state.getDatabase('db-1'));
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const timelineData = useMemo(() => {
        if (!database) return [];
        return database.pages.map(page => {
            const props = page.properties;

            // Resolving select property configurations to readable text
            let statusText = String(props['prop-status'] || 'Draft');
            const statusPropSchema = database.properties.find(p => p.id === 'prop-status');
            if (statusPropSchema?.type === 'select' && statusPropSchema.config?.options) {
                const opt = statusPropSchema.config.options.find(o => o.id === statusText);
                if (opt) statusText = opt.name;
            }

            return {
                id: page.id,
                title: String(props['title'] || 'Untitled Project'),
                status: statusText,
                plannedStart: props['prop-start-date'] ? new Date(props['prop-start-date'] as string) : null,
                plannedEnd: props['prop-end-date'] ? new Date(props['prop-end-date'] as string) : null,
                actualStart: props['prop-actual-start'] ? new Date(props['prop-actual-start'] as string) : null,
                actualEnd: props['prop-actual-end'] ? new Date(props['prop-actual-end'] as string) : null,
            };
        }).filter(p => p.plannedStart || p.actualStart); // Only show projects with schedules bounds
    }, [database]);

    if (!isMounted) return <div className="text-neutral-500 p-8">Loading operational framework...</div>;
    if (!database) return <div className="text-neutral-500 p-8">Initializing tracker...</div>;
    if (timelineData.length === 0) return <div className="text-neutral-500 p-8 font-medium">No active schedules. Assign planned or actual dates to projects in the Database Hub to visualize the timeline.</div>;

    // Calculate dynamic timeline bounds
    const allDates = timelineData.flatMap(p => [p.plannedStart, p.plannedEnd, p.actualStart, p.actualEnd]).filter((d): d is Date => d !== null);

    // Add timeline padding (1 month before earliest, 1 month after latest)
    const minDate = startOfMonth(addDays(new Date(Math.min(...allDates.map(d => d.getTime()))), -15));
    const maxDate = endOfMonth(addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 15));

    const totalDays = differenceInDays(maxDate, minDate) || 1;
    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    const getPosition = (date: Date) => {
        return (differenceInDays(date, minDate) / totalDays) * 100;
    };

    return (
        <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden flex flex-col mt-4">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
                    <CalendarIcon className="w-5 h-5 text-blue-500" />
                    Master Project Timeline
                </div>
                <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-neutral-500">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700" /> Planned Baseline</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500 shadow-sm shadow-blue-500/20" /> Actual Progress</div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar relative bg-neutral-50/30 dark:bg-black/20">
                <div className="min-w-[1000px] w-full h-full">
                    {/* Header: Months Axis */}
                    <div className="sticky top-0 z-20 flex h-10 border-b border-neutral-200 dark:border-white/10 bg-white/95 dark:bg-black/95 backdrop-blur-md">
                        <div className="w-72 shrink-0 border-r border-neutral-200 dark:border-white/10 p-2 flex items-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-white dark:bg-black">
                            Project Portfolio
                        </div>
                        <div className="flex-1 relative">
                            {months.map((month, i) => {
                                const left = getPosition(startOfMonth(month));
                                const right = getPosition(endOfMonth(month));
                                const width = right - left;
                                return (
                                    <div key={i} className="absolute h-full border-r border-dashed border-neutral-200 dark:border-white/10 flex items-center px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest"
                                        style={{ left: `${left}%`, width: `${width}%` }}>
                                        {format(month, 'MMM yyyy')}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline Grid */}
                    <div className="flex flex-col relative min-h-full pb-10">
                        {/* Vertical Axis Guidelines */}
                        <div className="absolute top-0 bottom-0 left-72 right-0 pointer-events-none z-0">
                            {months.map((month, i) => (
                                <div key={i} className="absolute top-0 bottom-0 border-r border-dashed border-neutral-200 dark:border-white/10" style={{ left: `${getPosition(endOfMonth(month))}%` }} />
                            ))}
                            {/* Today Marker */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-50 z-10 shadow-[0_0_8px_rgba(248,113,113,0.5)]" style={{ left: `${getPosition(new Date())}%` }} />
                        </div>

                        {/* Project Rows */}
                        {timelineData.map((project, index) => {
                            const pStart = project.plannedStart ? getPosition(project.plannedStart) : null;
                            const pEnd = project.plannedEnd ? getPosition(project.plannedEnd) : (pStart !== null ? pStart + 1 : null);
                            const pWidth = (pStart !== null && pEnd !== null) ? (pEnd - pStart) : 0;

                            const aStart = project.actualStart ? getPosition(project.actualStart) : null;
                            const aEnd = project.actualEnd ? getPosition(project.actualEnd) : (aStart !== null ? getPosition(new Date()) : null);
                            const aWidth = (aStart !== null && aEnd !== null) ? (aEnd - aStart) : 0;

                            return (
                                <div key={project.id} className="flex h-[88px] border-b border-neutral-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/[0.02] transition-colors group relative z-10">
                                    <div className="w-72 shrink-0 border-r border-neutral-100 dark:border-white/5 p-4 flex flex-col justify-center bg-white dark:bg-transparent transition-colors z-20 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
                                        <span className="font-bold text-sm text-neutral-900 dark:text-white truncate" title={project.title}>{project.title}</span>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[9px] px-2 py-1 rounded-sm bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-wider truncate">
                                                {project.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1 relative py-4 group-hover:bg-neutral-50 dark:group-hover:bg-white/[0.02] transition-colors">
                                        {/* Planned Baseline Bar */}
                                        {pStart !== null && (
                                            <div
                                                className="absolute h-6 top-3 bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg opacity-80"
                                                style={{ left: `${pStart}%`, width: `${Math.max(pWidth, 0.5)}%` }}
                                                title={`Planned: ${project.plannedStart?.toLocaleDateString()} - ${project.plannedEnd?.toLocaleDateString()}`}
                                            >
                                                {pWidth > 3 && (
                                                    <span className="absolute inset-0 flex items-center px-3 text-[9px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap overflow-hidden">
                                                        Planned
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Actual Progress Bar */}
                                        {aStart !== null && (
                                            <div
                                                className="absolute h-6 bottom-3 bg-blue-500 border border-blue-600 rounded-lg shadow-md shadow-blue-500/20 z-10 group/bar hover:scale-y-110 transition-transform origin-left"
                                                style={{ left: `${aStart}%`, width: `${Math.max(aWidth, 0.5)}%` }}
                                                title={`Actual: ${project.actualStart?.toLocaleDateString()} - ${project.actualEnd?.toLocaleDateString() || 'Ongoing'}`}
                                            >
                                                {aWidth > 3 && (
                                                    <span className="absolute inset-0 flex items-center px-3 text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap overflow-hidden">
                                                        {project.actualEnd ? 'Actual' : 'In Progress'}
                                                    </span>
                                                )}

                                                {/* Start/End handles inside bar for visual distinction */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20 rounded-l-md" />
                                                {project.actualEnd && <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/20 rounded-r-md" />}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
