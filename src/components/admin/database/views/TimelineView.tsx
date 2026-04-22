"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useDatabaseStore } from '../store';
import { Page, Property } from '../types';
import {
    addDays, differenceInDays, startOfDay, startOfMonth,
    endOfMonth, format, isSameMonth, isToday, eachDayOfInterval,
    eachWeekOfInterval, eachMonthOfInterval
} from 'date-fns';
import { ZoomIn, ZoomOut, CalendarDays } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type Scale = 'day' | 'week' | 'month' | 'quarter';

interface TimelineBar {
    page: Page;
    start: Date;
    end: Date;
    title: string;
    color: string;
}

interface TimelineViewProps {
    databaseId: string;
    viewId: string;
    renderTabs?: React.ReactNode;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const SCALE_CELL_WIDTH: Record<Scale, number> = { day: 40, week: 50, month: 120, quarter: 160 };
const SCALE_LABELS: Record<Scale, string> = { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter' };
const ROW_HEIGHT = 40;
const SIDE_PANEL_WIDTH = 220;

const BAR_COLORS = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];
const BAR_COLORS_DARK = [
    'dark:bg-blue-600', 'dark:bg-emerald-600', 'dark:bg-amber-600', 'dark:bg-purple-600',
    'dark:bg-pink-600', 'dark:bg-cyan-600', 'dark:bg-orange-600', 'dark:bg-indigo-600',
];

function parseDateSafe(val: unknown, fallback: Date): Date {
    if (!val) return fallback;
    const str = String(val);
    // Handle Excel serial numbers (e.g. "45737")
    if (/^\d{4,5}$/.test(str.trim())) {
        const serial = Number(str.trim());
        if (serial > 30000 && serial < 80000) {
            return new Date(Math.round((serial - 25569) * 86400 * 1000));
        }
    }
    const euroMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (euroMatch) {
        const [, day, month, year] = euroMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? fallback : parsed;
}

function getStatusColor(page: Page, statusProps: Property[]): number {
    for (const prop of statusProps) {
        const val = page.properties[prop.id];
        if (val && prop.config?.options) {
            const opt = prop.config.options.find(o => o.id === val);
            if (opt) {
                const colors: Record<string, number> = {
                    gray: 0, blue: 0, green: 1, orange: 2, purple: 3, pink: 4, red: 5, yellow: 6, brown: 7,
                };
                return colors[opt.color] ?? 0;
            }
        }
    }
    return 0;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TimelineView({ databaseId, viewId, renderTabs }: TimelineViewProps) {
    const database = useDatabaseStore(state => state.getDatabase(databaseId));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const updateView = useDatabaseStore(state => state.updateView);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerScrollRef = useRef<HTMLDivElement>(null);

    const [dragState, setDragState] = useState<{
        pageId: string;
        type: 'move' | 'resize-left' | 'resize-right';
        startX: number;
        originalStart: Date;
        originalEnd: Date;
        currentDeltaDays: number;
    } | null>(null);

    // Derive config (safe with null database)
    const view = database?.views.find(v => v.id === viewId);
    const scale: Scale = view?.config?.timelineScale || 'week';
    const cellWidth = SCALE_CELL_WIDTH[scale];

    const startDatePropId = view?.config?.startDatePropertyId ||
        database?.properties.find(p => p.type === 'date' && /start|begin|van|factuur/i.test(p.name))?.id ||
        database?.properties.find(p => p.type === 'date')?.id ||
        undefined;

    const endDatePropId = view?.config?.endDatePropertyId ||
        database?.properties.find(p => p.type === 'date' && /end|eind|deadline|due|verval|tot/i.test(p.name))?.id ||
        undefined;

    const statusProps = useMemo(() => database?.properties.filter(p => p.type === 'select') || [], [database?.properties]);

    // Build timeline bars
    const bars: TimelineBar[] = useMemo(() => {
        if (!database || !startDatePropId) return [];
        const now = new Date();
        return database.pages
            .map(page => {
                const rawStart = page.properties[startDatePropId];
                if (!rawStart) return null;
                const start = startOfDay(parseDateSafe(rawStart, now));
                const end = endDatePropId
                    ? startOfDay(parseDateSafe(page.properties[endDatePropId], addDays(start, 3)))
                    : addDays(start, 3);
                const colorIdx = getStatusColor(page, statusProps);
                return {
                    page, start,
                    end: end < start ? addDays(start, 1) : end,
                    title: String(page.properties['title'] || 'Untitled'),
                    color: `${BAR_COLORS[colorIdx % BAR_COLORS.length]} ${BAR_COLORS_DARK[colorIdx % BAR_COLORS_DARK.length]}`,
                };
            })
            .filter(Boolean) as TimelineBar[];
    }, [database?.pages, startDatePropId, endDatePropId, statusProps]);

    // Calculate timeline range
    const { timelineStart, timelineEnd, columns } = useMemo(() => {
        if (bars.length === 0) {
            const now = new Date();
            const s = addDays(startOfMonth(now), -7);
            const e = addDays(endOfMonth(now), 14);
            return { timelineStart: s, timelineEnd: e, columns: eachDayOfInterval({ start: s, end: e }) };
        }
        const allStarts = bars.map(b => b.start.getTime());
        const allEnds = bars.map(b => b.end.getTime());
        const s = addDays(startOfMonth(new Date(Math.min(...allStarts))), -7);
        const e = addDays(endOfMonth(new Date(Math.max(...allEnds))), 14);
        let cols: Date[];
        switch (scale) {
            case 'day': cols = eachDayOfInterval({ start: s, end: e }); break;
            case 'week': cols = eachWeekOfInterval({ start: s, end: e }, { weekStartsOn: 1 }); break;
            case 'month': cols = eachMonthOfInterval({ start: s, end: e }); break;
            case 'quarter': cols = eachMonthOfInterval({ start: s, end: e }).filter((_, i) => i % 3 === 0); break;
            default: cols = eachDayOfInterval({ start: s, end: e });
        }
        return { timelineStart: s, timelineEnd: e, columns: cols };
    }, [bars, scale]);

    const totalWidth = columns.length * cellWidth;

    const getBarLeft = useCallback((date: Date) => {
        const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
        return (differenceInDays(date, timelineStart) / totalDays) * totalWidth;
    }, [timelineStart, timelineEnd, totalWidth]);

    const getBarWidth = useCallback((start: Date, end: Date) => {
        const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
        return (Math.max(1, differenceInDays(end, start)) / totalDays) * totalWidth;
    }, [timelineStart, timelineEnd, totalWidth]);

    const handleScroll = useCallback(() => {
        if (scrollContainerRef.current && headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent, pageId: string, type: 'move' | 'resize-left' | 'resize-right', bar: TimelineBar) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState({ pageId, type, startX: e.clientX, originalStart: bar.start, originalEnd: bar.end, currentDeltaDays: 0 });
    }, []);

    useEffect(() => {
        if (!dragState) return;
        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragState.startX;
            const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
            setDragState(prev => prev ? { ...prev, currentDeltaDays: Math.round((dx / totalWidth) * totalDays) } : null);
        };
        const handleMouseUp = () => {
            if (!dragState || !startDatePropId) return;
            const { pageId, type, originalStart, originalEnd, currentDeltaDays: d } = dragState;
            if (d !== 0) {
                if (type === 'move') {
                    updatePageProperty(databaseId, pageId, startDatePropId, addDays(originalStart, d).toISOString());
                    if (endDatePropId) updatePageProperty(databaseId, pageId, endDatePropId, addDays(originalEnd, d).toISOString());
                } else if (type === 'resize-left') {
                    updatePageProperty(databaseId, pageId, startDatePropId, addDays(originalStart, d).toISOString());
                } else if (type === 'resize-right' && endDatePropId) {
                    updatePageProperty(databaseId, pageId, endDatePropId, addDays(originalEnd, d).toISOString());
                }
            }
            setDragState(null);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [dragState, databaseId, startDatePropId, endDatePropId, timelineStart, timelineEnd, totalWidth, updatePageProperty]);

    const scaleOrder: Scale[] = useMemo(() => ['day', 'week', 'month', 'quarter'], []);
    const currentScaleIdx = scaleOrder.indexOf(scale);
    const setScale = useCallback((s: Scale) => updateView(databaseId, viewId, { config: { ...view?.config, timelineScale: s } }), [updateView, databaseId, viewId, view?.config]);

    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayOffset = getBarLeft(new Date());
            scrollContainerRef.current.scrollLeft = Math.max(0, todayOffset - scrollContainerRef.current.clientWidth / 3);
        }
    }, [getBarLeft]);

    // ── Guards (AFTER all hooks) ──
    if (!database) return <div className="p-8 text-neutral-500">Loading...</div>;

    if (!startDatePropId) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                <div className="px-3 pt-2.5 pb-0 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end justify-between relative z-[60] flex-wrap gap-2">
                    <div className="flex items-end pr-2 shrink-0">{renderTabs || <h2 className="text-lg font-semibold text-neutral-900 dark:text-white pb-2">{database.name}</h2>}</div>
                </div>
                <div className="flex-1 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                        <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold mb-1">No date properties found</p>
                        <p className="text-sm">Add a Date property to use the Timeline view.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render computations ──
    const todayLeft = getBarLeft(new Date());
    const renderBars = bars.map((bar, idx) => {
        let barStart = bar.start;
        let barEnd = bar.end;
        if (dragState?.pageId === bar.page.id) {
            const d = dragState.currentDeltaDays;
            if (dragState.type === 'move') { barStart = addDays(dragState.originalStart, d); barEnd = addDays(dragState.originalEnd, d); }
            else if (dragState.type === 'resize-left') { barStart = addDays(dragState.originalStart, d); if (barStart >= barEnd) barStart = addDays(barEnd, -1); }
            else if (dragState.type === 'resize-right') { barEnd = addDays(dragState.originalEnd, d); if (barEnd <= barStart) barEnd = addDays(barStart, 1); }
        }
        return { ...bar, left: getBarLeft(barStart), width: getBarWidth(barStart, barEnd), barStart, barEnd, isDragging: dragState?.pageId === bar.page.id, idx };
    });

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm relative">
            {/* Header */}
            <div className="px-3 pt-2.5 pb-0 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end justify-between relative z-[60] flex-wrap gap-2">
                <div className="flex items-end pr-2 shrink-0">
                    {renderTabs ? renderTabs : (
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 pb-2">
                            {database.icon && <span>{database.icon}</span>}
                            {database.name}
                        </h2>
                    )}
                </div>
                <div className="flex items-center gap-1 pb-2">
                    <button onClick={() => currentScaleIdx > 0 && setScale(scaleOrder[currentScaleIdx - 1])} disabled={currentScaleIdx === 0} className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 min-w-[50px] text-center">{SCALE_LABELS[scale]}</span>
                    <button onClick={() => currentScaleIdx < scaleOrder.length - 1 && setScale(scaleOrder[currentScaleIdx + 1])} disabled={currentScaleIdx === scaleOrder.length - 1} className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (scrollContainerRef.current) { scrollContainerRef.current.scrollTo({ left: Math.max(0, getBarLeft(new Date()) - scrollContainerRef.current.clientWidth / 3), behavior: 'smooth' }); } }} className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors ml-1" title="Jump to today"><CalendarDays className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {/* Timeline body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Side panel */}
                <div className="flex flex-col border-r border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/50" style={{ width: SIDE_PANEL_WIDTH, minWidth: SIDE_PANEL_WIDTH }}>
                    <div className="h-[52px] border-b border-neutral-200 dark:border-white/10 flex items-end px-3 pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Records</span>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {renderBars.map(bar => (
                            <div key={bar.page.id} className="flex items-center px-3 border-b border-neutral-100 dark:border-white/5 text-sm text-neutral-700 dark:text-neutral-300 truncate" style={{ height: ROW_HEIGHT }} title={bar.title}>
                                <span className="truncate font-medium">{bar.title}</span>
                            </div>
                        ))}
                        {bars.length === 0 && <div className="p-4 text-xs text-neutral-400 text-center">No records with dates</div>}
                    </div>
                </div>

                {/* Timeline grid */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    {/* Date headers */}
                    <div ref={headerScrollRef} className="h-[52px] border-b border-neutral-200 dark:border-white/10 overflow-hidden bg-neutral-50/80 dark:bg-neutral-900/80">
                        <div className="flex h-full relative" style={{ width: totalWidth }}>
                            <div className="absolute top-0 left-0 flex h-[26px]" style={{ width: totalWidth }}>
                                {columns.map((col, i) => {
                                    const showMonth = i === 0 || !isSameMonth(col, columns[i - 1]);
                                    if (!showMonth && scale !== 'month' && scale !== 'quarter') return null;
                                    return <div key={col.getTime()} className="absolute top-0 flex items-end px-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400" style={{ left: i * cellWidth }}>{format(col, scale === 'quarter' ? 'QQQ yyyy' : 'MMM yyyy')}</div>;
                                })}
                            </div>
                            <div className="absolute top-[26px] left-0 flex h-[26px]" style={{ width: totalWidth }}>
                                {columns.map((col, i) => (
                                    <div key={col.getTime()} className={`flex items-center justify-center text-[10px] font-medium border-r border-neutral-100 dark:border-white/5 ${isToday(col) ? 'text-red-500 font-bold bg-red-50 dark:bg-red-950/20' : 'text-neutral-400'}`} style={{ width: cellWidth, minWidth: cellWidth }}>
                                        {scale === 'day' && format(col, 'd')}
                                        {scale === 'week' && `W${format(col, 'w')}`}
                                        {scale === 'month' && format(col, 'MMM')}
                                        {scale === 'quarter' && format(col, 'QQQ')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable bar area */}
                    <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-auto no-scrollbar relative">
                        <div className="relative" style={{ width: totalWidth, minHeight: bars.length * ROW_HEIGHT || 200 }}>
                            {/* Grid lines */}
                            {columns.map((col, i) => <div key={col.getTime()} className={`absolute top-0 bottom-0 border-r ${isToday(col) ? 'border-red-300 dark:border-red-700' : 'border-neutral-100 dark:border-white/5'}`} style={{ left: i * cellWidth }} />)}

                            {/* Today marker */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: todayLeft }}>
                                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
                            </div>

                            {/* Row backgrounds */}
                            {renderBars.map((bar, i) => <div key={`row-${bar.page.id}`} className={`absolute left-0 right-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-neutral-50/40 dark:bg-white/[0.015]'}`} style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }} />)}

                            {/* Bars */}
                            {renderBars.map(bar => (
                                <div key={bar.page.id} className={`absolute flex items-center rounded-md shadow-sm transition-shadow group ${bar.color} ${bar.isDragging ? 'opacity-80 shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'}`} style={{ left: bar.left, width: Math.max(bar.width, 20), top: bar.idx * ROW_HEIGHT + 6, height: ROW_HEIGHT - 12, cursor: dragState ? 'grabbing' : 'grab', zIndex: bar.isDragging ? 50 : 1 }} onMouseDown={e => handleMouseDown(e, bar.page.id, 'move', bar)}>
                                    <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-l-md transition-colors" onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, bar.page.id, 'resize-left', bar); }} />
                                    <span className="text-[11px] font-semibold text-white truncate px-2.5 select-none pointer-events-none">{bar.title}</span>
                                    <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-r-md transition-colors" onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, bar.page.id, 'resize-right', bar); }} />
                                </div>
                            ))}

                            {/* Empty state */}
                            {bars.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                                    <div className="text-center">
                                        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm font-medium">No records to display</p>
                                        <p className="text-xs mt-1">Add dates to your records to see them on the timeline</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
