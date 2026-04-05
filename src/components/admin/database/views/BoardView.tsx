"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Property, SelectOption } from '@/components/admin/database/types';
import { GripVertical, User2, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/components/time-tracker/lib/utils';

interface BoardViewProps {
    databaseId: string;
    viewId: string;
    renderTabs?: React.ReactNode;
}

export default function BoardView({ databaseId, viewId, renderTabs }: BoardViewProps) {
    const database = useDatabaseStore(state => state.getDatabase(databaseId));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    const [draggedPageId, setDraggedPageId] = useState<string | null>(null);

    if (!database) return null;

    const view = database.views.find(v => v.id === viewId);
    const groupByPropertyId = view?.config?.groupByPropertyId;

    const groupProperty = database.properties.find(p => p.id === groupByPropertyId);

    if (!groupProperty || (groupProperty.type !== 'select' && groupProperty.type !== 'multi_select')) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-neutral-500">
                <p className="mb-2">This board view requires a valid "Select" or "Multi-select" property to group by.</p>
                <p className="text-sm opacity-80">Please edit the view configuration to select a group-by property.</p>
            </div>
        );
    }

    const options: SelectOption[] = groupProperty.config?.options || [];

    // Create columns based on options + a "No Status" column
    const columns = [...options, { id: 'no-status', name: 'No Status', color: 'gray' }];

    const handleDragStart = (e: React.DragEvent, pageId: string) => {
        setDraggedPageId(pageId);
        e.dataTransfer.setData('text/plain', pageId);
        // Add a slight opacity to the dragged element
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            const target = e.target as HTMLElement;
            if (target) target.style.opacity = '0.5';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedPageId(null);
        const target = e.target as HTMLElement;
        if (target) target.style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetOptionId: string) => {
        e.preventDefault();
        const pageId = e.dataTransfer.getData('text/plain');
        if (!pageId || pageId === draggedPageId) {
            // We ensure we update via state, the pageId check might suffice
        }

        // Update the page property to the new status
        const newValue = targetOptionId === 'no-status' ? null : targetOptionId;
        updatePageProperty(databaseId, pageId, groupProperty.id, newValue);
        setDraggedPageId(null);
    };

    // Helper to get color classes
    const getColorClasses = (color: string) => {
        const colors: Record<string, string> = {
            default: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
            gray: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
            brown: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
            orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
            yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
            blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
            pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
            red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };
        return colors[color] || colors.default;
    };

    const getHeaderColor = (color: string) => {
        const colors: Record<string, string> = {
            default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
            gray: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
            brown: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
            red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        };
        return colors[color] || colors.default;
    }

    // Find priority and date property for card metadata display (if they exist)
    const priorityProp = database.properties.find(p => p.name.toLowerCase().includes('priority'));
    const dateProp = database.properties.find(p => p.type === 'date');

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm relative">
            <div className="px-3 pt-2.5 pb-0 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end justify-between relative z-[60] flex-wrap gap-2">
                <div className="flex items-end pr-2 shrink-0">
                    {renderTabs ? renderTabs : (
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 pb-2">
                            {database.icon && <span>{database.icon}</span>}
                            {database.name}
                        </h2>
                    )}
                </div>
            </div>

            <div className="flex-1 flex w-full h-full overflow-x-auto overflow-y-hidden bg-neutral-50/50 dark:bg-neutral-900/20 p-6 no-scrollbar gap-6 relative min-h-0">
                {columns.map((col) => {
                    // Filter pages that match this column
                    const columnPages = database.pages.filter(page => {
                        const val = page.properties[groupProperty.id];
                        if (col.id === 'no-status') {
                            return !val || (Array.isArray(val) && val.length === 0);
                        }
                        // Handle both single select and multi-select (checking if array includes col.id)
                        if (Array.isArray(val)) {
                            return val.includes(col.id);
                        }
                        return val === col.id;
                    });

                    // Skip "No Status" column if it's empty to keep the UI clean
                    if (col.id === 'no-status' && columnPages.length === 0) return null;

                    return (
                        <div
                            key={col.id}
                            className="flex flex-col min-w-[320px] max-w-[320px] shrink-0"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <div className={cn("px-2 py-0.5 rounded text-xs font-medium", getHeaderColor(col.color))}>
                                    {col.name}
                                </div>
                                <span className="text-sm text-neutral-400">{columnPages.length}</span>
                            </div>

                            {/* Column Body / Dropzone */}
                            <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-3">
                                {columnPages.map(page => {
                                    const title = page.properties['title'] || 'Untitled';

                                    // Get priority label if property exists
                                    let priorityMarkup = null;
                                    if (priorityProp) {
                                        const pVal = page.properties[priorityProp.id] as string;
                                        const pOpt = priorityProp.config?.options?.find(o => o.id === pVal);
                                        if (pOpt) {
                                            priorityMarkup = (
                                                <div className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", getColorClasses(pOpt.color))}>
                                                    {pOpt.name}
                                                </div>
                                            )
                                        }
                                    }

                                    // Get date if property exists
                                    let dateStr = '';
                                    if (dateProp) {
                                        const dVal = page.properties[dateProp.id] as string;
                                        if (dVal) {
                                            dateStr = format(new Date(dVal), 'MMM d, yyyy');
                                        }
                                    }

                                    return (
                                        <div
                                            key={page.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, page.id)}
                                            onDragEnd={handleDragEnd}
                                            className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-neutral-300 dark:hover:border-white/20"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="line-clamp-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-snug">
                                                    {title}
                                                </div>
                                                <button className="opacity-0 group-hover:opacity-100 p-1 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-600 transition-opacity">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2 mt-4 mt-auto">
                                                {/* Status/Priority Tags */}
                                                {priorityMarkup}

                                                <div className="flex-1" />

                                                {/* Date */}
                                                {dateStr && (
                                                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {dateStr}
                                                    </div>
                                                )}

                                                {/* Assignee Avatar Stub */}
                                                <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center border border-white dark:border-neutral-900 shrink-0 ml-1">
                                                    <User2 className="w-3 h-3 text-neutral-500" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Invisible drop target padding to make dropping into empty columns easier */}
                                <div className="h-20 w-full" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
