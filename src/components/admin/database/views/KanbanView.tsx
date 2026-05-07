"use client";

import React, { useState, useMemo } from 'react';
import { useDatabaseStore } from '../store';
import { SelectOption, Page, Property } from '../types';
import {
    DndContext, closestCorners, DragOverlay, DragStartEvent, DragEndEvent,
    useSensor, useSensors, PointerSensor, KeyboardSensor,
    UniqueIdentifier,
    DragOverEvent
} from '@dnd-kit/core';
import { 
    SortableContext, 
    verticalListSortingStrategy, 
    horizontalListSortingStrategy,
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, ChevronRight, ChevronDown, AlertTriangle, User2, Calendar as CalendarIcon, GripHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/components/time-tracker/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface KanbanViewProps {
    databaseId: string;
    viewId: string;
    renderTabs?: React.ReactNode;
}

interface KanbanColumn {
    id: string;
    name: string;
    color: string;
    pages: Page[];
    isCollapsed: boolean;
    wipLimit?: number;
}

// ── Color helpers ──────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; text: string; header: string; border: string }> = {
    default: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-300', header: 'bg-neutral-200/60 dark:bg-neutral-800', border: 'border-neutral-200 dark:border-neutral-700' },
    gray:    { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-300', header: 'bg-neutral-200/60 dark:bg-neutral-800', border: 'border-neutral-200 dark:border-neutral-700' },
    brown:   { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-800 dark:text-amber-300', header: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
    orange:  { bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-800 dark:text-orange-300', header: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800' },
    yellow:  { bg: 'bg-yellow-50 dark:bg-yellow-950/20', text: 'text-yellow-800 dark:text-yellow-300', header: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-200 dark:border-yellow-800' },
    green:   { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-800 dark:text-emerald-300', header: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
    blue:    { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-800 dark:text-blue-300', header: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
    purple:  { bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-800 dark:text-purple-300', header: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
    pink:    { bg: 'bg-pink-50 dark:bg-pink-950/20', text: 'text-pink-800 dark:text-pink-300', header: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-200 dark:border-pink-800' },
    red:     { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-800 dark:text-red-300', header: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
};

function getColor(color: string) { return COLOR_MAP[color] || COLOR_MAP.default; }

// ── Sortable Card ──────────────────────────────────────────────────────────────
function SortableCard({ page, dateProp, priorityProp, coverProp, databaseId }: {
    page: Page;
    dateProp: Property | undefined;
    priorityProp: Property | undefined;
    coverProp: Property | undefined;
    databaseId: string;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
        id: page.id,
        data: { type: 'card', page }
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    const title = String(page.properties['title'] || 'Untitled');

    // Card Cover
    let coverUrl = '';
    if (coverProp) {
        const val = page.properties[coverProp.id];
        if (typeof val === 'string' && val.startsWith('http')) coverUrl = val;
    }

    let priorityMarkup = null;
    if (priorityProp) {
        const pVal = page.properties[priorityProp.id] as string;
        const pOpt = priorityProp.config?.options?.find(o => o.id === pVal);
        if (pOpt) {
            const c = getColor(pOpt.color);
            priorityMarkup = <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", c.bg, c.text)}>{pOpt.name}</span>;
        }
    }

    let dateStr = '';
    if (dateProp) {
        const dVal = page.properties[dateProp.id] as string;
        if (dVal) { try { dateStr = format(new Date(dVal), 'MMM d'); } catch { /* */ } }
    }

    const handleSaveTitle = () => {
        if (editTitle.trim() && editTitle.trim() !== title) updatePageProperty(databaseId, page.id, 'title', editTitle.trim());
        setIsEditing(false);
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes} 
            {...listeners} 
            className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-neutral-300 dark:hover:border-white/20 flex flex-col"
        >
            {coverUrl && (
                <div className="w-full h-32 overflow-hidden border-b border-neutral-100 dark:border-white/5 bg-neutral-100 dark:bg-neutral-800">
                    <img src={coverUrl} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                </div>
            )}
            <div className="p-3">
                <div className="flex items-start justify-between mb-1">
                    {isEditing ? (
                        <input className="flex-1 text-sm font-semibold text-neutral-800 dark:text-neutral-200 bg-transparent border-b border-blue-400 outline-none px-0 py-0.5" value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={handleSaveTitle} onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditing(false); }} autoFocus />
                    ) : (
                        <div className="line-clamp-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-snug cursor-text" onClick={e => { e.stopPropagation(); setIsEditing(true); setEditTitle(title); }}>{title}</div>
                    )}
                    <button className="opacity-0 group-hover:opacity-100 p-1 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-600 transition-opacity flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                    {priorityMarkup}
                    <div className="flex-1" />
                    {dateStr && <div className="flex items-center gap-1 text-xs text-neutral-400"><CalendarIcon className="w-3 h-3" />{dateStr}</div>}
                    <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center border border-white dark:border-neutral-900 shrink-0"><User2 className="w-3 h-3 text-neutral-500" /></div>
                </div>
            </div>
        </div>
    );
}

// ── Sortable Column ────────────────────────────────────────────────────────────
function SortableColumn({ 
    col, 
    databaseId, 
    viewId, 
    groupProperty, 
    dateProp, 
    priorityProp, 
    coverProp,
    toggleCollapse, 
    handleQuickAdd 
}: {
    col: KanbanColumn;
    databaseId: string;
    viewId: string;
    groupProperty: Property;
    dateProp?: Property;
    priorityProp?: Property;
    coverProp?: Property;
    toggleCollapse: (id: string) => void;
    handleQuickAdd: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
        id: col.id,
        data: { type: 'column', column: col }
    });

    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    const c = getColor(col.color);
    const isOverLimit = col.wipLimit && col.pages.length > col.wipLimit;

    if (col.isCollapsed) {
        return (
            <div 
                ref={setNodeRef} 
                style={style}
                {...attributes}
                {...listeners}
                className={cn("flex flex-col items-center w-10 shrink-0 rounded-lg cursor-pointer transition-colors py-3 group relative", c.header, "hover:opacity-80")} 
                onClick={() => toggleCollapse(col.id)} 
                title={`${col.name} (${col.pages.length})`}
            >
                <ChevronRight className="w-3.5 h-3.5 mb-2 text-neutral-500" />
                <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{col.name}</div>
                <span className="mt-2 text-[10px] font-bold text-neutral-400">{col.pages.length}</span>
                {/* Drag Handle Indicator */}
                <div className="absolute top-0 inset-x-0 h-1 bg-blue-500/0 group-hover:bg-blue-500/20 transition-colors rounded-t-lg" />
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col min-w-[300px] max-w-[300px] shrink-0 group">
            <div className="flex items-center gap-2 mb-3 px-1" {...attributes} {...listeners}>
                <button onClick={(e) => { e.stopPropagation(); toggleCollapse(col.id); }} className="p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                <div className={cn("px-2.5 py-0.5 rounded-md text-xs font-semibold", c.header, c.text)}>{col.name}</div>
                <span className={cn("text-xs font-medium", isOverLimit ? 'text-red-500' : 'text-neutral-400')}>
                    {col.pages.length}{col.wipLimit && <span className="opacity-60">/{col.wipLimit}</span>}
                </span>
                {isOverLimit && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                <div className="flex-1" />
                <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(col.id); }} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 rounded transition-colors" title="Add card"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            
            <SortableContext items={col.pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-2.5 min-h-[100px] rounded-lg bg-transparent">
                    {col.pages.map(page => (
                        <SortableCard 
                            key={page.id} 
                            page={page} 
                            dateProp={dateProp} 
                            priorityProp={priorityProp} 
                            coverProp={coverProp}
                            databaseId={databaseId} 
                        />
                    ))}
                    {col.pages.length === 0 && (
                        <div className="flex items-center justify-center h-20 border-2 border-dashed border-neutral-200 dark:border-white/10 rounded-lg text-xs text-neutral-400">
                            Drop here
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function KanbanView({ databaseId, viewId, renderTabs }: KanbanViewProps) {
    const database = useDatabaseStore(state => state.getDatabase(databaseId));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const updateView = useDatabaseStore(state => state.updateView);
    const updatePropertyOptionOrder = useDatabaseStore(state => state.updatePropertyOptionOrder);
    const createPage = useDatabaseStore(state => state.createPage);

    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const [activeType, setActiveType] = useState<'card' | 'column' | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    );

    // Derive config (null-safe)
    const view = database?.views.find(v => v.id === viewId);
    const groupByPropertyId = view?.config?.groupByPropertyId;
    const groupProperty = database?.properties.find(p => p.id === groupByPropertyId);
    const isValidGroup = groupProperty && (groupProperty.type === 'select' || groupProperty.type === 'multi_select');
    const options: SelectOption[] = (isValidGroup ? groupProperty.config?.options : []) || [];
    const collapsedCols = view?.config?.kanbanCollapsedColumns || [];
    const wipLimits = view?.config?.kanbanWipLimits || {};
    const coverPropId = view?.config?.kanbanCardCoverPropertyId;
    const coverProp = database?.properties.find(p => p.id === coverPropId);

    // Build columns
    const columns: KanbanColumn[] = useMemo(() => {
        if (!database || !groupProperty || !isValidGroup) return [];
        const cols: KanbanColumn[] = options.map(opt => ({
            id: opt.id, name: opt.name, color: opt.color,
            pages: database.pages.filter(p => { const val = p.properties[groupProperty.id]; return Array.isArray(val) ? val.includes(opt.id) : val === opt.id; }),
            isCollapsed: collapsedCols.includes(opt.id),
            wipLimit: wipLimits[opt.id],
        }));
        const unassigned = database.pages.filter(p => { const val = p.properties[groupProperty.id]; return !val || (Array.isArray(val) && val.length === 0); });
        if (unassigned.length > 0) {
            cols.push({ id: 'no-status', name: 'No Status', color: 'gray', pages: unassigned, isCollapsed: collapsedCols.includes('no-status') });
        }
        return cols;
    }, [database?.pages, options, groupProperty?.id, isValidGroup, collapsedCols, wipLimits]);

    const priorityProp = useMemo(() => database?.properties.find(p => p.name.toLowerCase().includes('priority') || p.name.toLowerCase().includes('prioriteit')), [database?.properties]);
    const dateProp = useMemo(() => database?.properties.find(p => p.type === 'date'), [database?.properties]);
    
    const activeData = useMemo(() => {
        if (!activeId) return null;
        if (activeType === 'card') return database?.pages.find(p => p.id === activeId);
        if (activeType === 'column') return columns.find(c => c.id === activeId);
        return null;
    }, [activeId, activeType, database?.pages, columns]);

    // ── Guards (AFTER all hooks) ──
    if (!database) return null;

    if (!isValidGroup) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                <div className="px-3 pt-2.5 pb-0 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end justify-between relative z-[60] flex-wrap gap-2">
                    <div className="flex items-end pr-2 shrink-0">{renderTabs || <h2 className="text-lg font-semibold text-neutral-900 dark:text-white pb-2">{database.name}</h2>}</div>
                </div>
                <div className="flex-1 flex items-center justify-center p-8 text-neutral-500">
                    <div className="text-center">
                        <p className="mb-2 font-semibold">Board view requires a Select property</p>
                        <p className="text-sm opacity-80">Edit the view configuration to select a group-by property.</p>
                    </div>
                </div>
            </div>
        );
    }

    const toggleCollapse = (colId: string) => {
        const current = collapsedCols.includes(colId) ? collapsedCols.filter(id => id !== colId) : [...collapsedCols, colId];
        updateView(databaseId, viewId, { config: { ...view?.config, kanbanCollapsedColumns: current } });
    };

    const handleQuickAdd = (colId: string) => {
        createPage(databaseId, { title: '', [groupProperty!.id]: colId === 'no-status' ? null : colId });
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveType(active.data.current?.type || 'card');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);
        if (!over) return;

        if (activeType === 'column') {
            const oldIndex = options.findIndex(o => o.id === active.id);
            const newIndex = options.findIndex(o => o.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                updatePropertyOptionOrder(databaseId, groupProperty!.id, oldIndex, newIndex);
            }
            return;
        }

        // Card dragging
        const pageId = String(active.id);
        let targetColId: string | null = null;
        
        // Find column by ID or by finding column containing the over element
        for (const col of columns) {
            if (col.id === over.id) { targetColId = col.id; break; }
            if (col.pages.some(p => p.id === over.id)) { targetColId = col.id; break; }
        }

        if (targetColId) {
            updatePageProperty(databaseId, pageId, groupProperty!.id, targetColId === 'no-status' ? null : targetColId);
        }
    };

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

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex-1 flex w-full h-full overflow-x-auto overflow-y-hidden bg-neutral-50/50 dark:bg-neutral-900/20 p-6 no-scrollbar gap-4 relative min-h-0">
                    <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                        {columns.map(col => (
                            <SortableColumn 
                                key={col.id} 
                                col={col} 
                                databaseId={databaseId}
                                viewId={viewId}
                                groupProperty={groupProperty!}
                                dateProp={dateProp}
                                priorityProp={priorityProp}
                                coverProp={coverProp}
                                toggleCollapse={toggleCollapse}
                                handleQuickAdd={handleQuickAdd}
                            />
                        ))}
                    </SortableContext>
                </div>

                <DragOverlay dropAnimation={{
                    duration: 250,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}>
                    {activeId && activeType === 'card' && (
                        <div className="bg-white dark:bg-neutral-900 border border-blue-400 rounded-lg p-3 shadow-xl w-[300px] opacity-90 rotate-2 cursor-grabbing">
                            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                {String((activeData as Page)?.properties?.['title'] || 'Untitled')}
                            </div>
                        </div>
                    )}
                    {activeId && activeType === 'column' && (
                        <div className="flex flex-col min-w-[300px] max-w-[300px] bg-neutral-100/50 dark:bg-neutral-800/50 rounded-lg p-2 border border-blue-400 shadow-xl opacity-90 rotate-1 cursor-grabbing">
                             <div className={cn("px-2.5 py-0.5 rounded-md text-xs font-semibold w-fit mb-3", getColor((activeData as KanbanColumn).color).header)}>
                                {(activeData as KanbanColumn).name}
                            </div>
                            <div className="space-y-2 opacity-30">
                                <div className="h-20 bg-white dark:bg-neutral-900 rounded-lg" />
                                <div className="h-20 bg-white dark:bg-neutral-900 rounded-lg" />
                            </div>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
