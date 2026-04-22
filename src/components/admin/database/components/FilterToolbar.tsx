"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDatabaseStore } from '../store';
import { FilterOperator } from '../types';
import { Filter, Plus, Trash2, X, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FilterToolbarProps {
    databaseId: string;
    viewId?: string;
}

const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'does_not_contain', label: 'Does not contain', needsValue: true },
    { value: 'equals', label: 'Is', needsValue: true },
    { value: 'does_not_equal', label: 'Is not', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false }
];

export default function FilterToolbar({ databaseId, viewId }: FilterToolbarProps) {
    const addFilter = useDatabaseStore(state => state.addFilter);
    const updateFilter = useDatabaseStore(state => state.updateFilter);
    const removeFilter = useDatabaseStore(state => state.removeFilter);
    const clearFilters = useDatabaseStore(state => state.clearFilters);
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
    const t = useTranslations('Admin');

    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));

    const activeFilters = database
        ? (viewId
            ? database.views.find(v => v.id === viewId)?.filters || []
            : database.activeFilters || [])
        : [];

    // Auto-open when first filter is added via the button
    const pendingOpen = useRef(false);

    // Position panel below the trigger button (portal needs explicit coords)
    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPanelPos({
                top: rect.bottom + 6,
                left: Math.max(8, rect.right - 520), // 520 = panel width, keep on screen
            });
        }
    }, []);

    useEffect(() => {
        if (pendingOpen.current && activeFilters.length > 0) {
            pendingOpen.current = false;
            const t = setTimeout(() => setIsOpen(true), 0);
            return () => clearTimeout(t);
        }
    }, [activeFilters.length]);

    // Reposition on scroll/resize while open
    useEffect(() => {
        if (!isOpen) return;
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const listener = (e: MouseEvent) => {
            if (buttonRef.current?.contains(e.target as Node)) return;
            if (panelRef.current?.contains(e.target as Node)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', listener);
        return () => document.removeEventListener('mousedown', listener);
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    if (!database) return null;

    const handleAddFilter = () => {
        if (database.properties.length === 0) return;
        pendingOpen.current = true;
        addFilter(databaseId, viewId, {
            propertyId: database.properties[0].id,
            operator: 'contains',
            value: ''
        });
    };

    const handleClearAll = () => {
        clearFilters(databaseId, viewId);
        setIsOpen(false);
    };

    // ── Portal Panel ──
    const panel = isOpen && panelPos && typeof document !== 'undefined' && createPortal(
        <div
            ref={panelRef}
            className="fixed w-[520px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: panelPos.top, left: panelPos.left, zIndex: 99999, animation: 'filterFlyoutIn 150ms ease-out' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-white/5">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                    {activeFilters.length > 0 ? `${activeFilters.length} active filter${activeFilters.length > 1 ? 's' : ''}` : 'Filters'}
                </span>
                <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                        <button onClick={handleClearAll} className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors">
                            Clear all
                        </button>
                    )}
                    <button onClick={() => setIsOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Filter Rules */}
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                {activeFilters.length === 0 ? (
                    <div className="text-center py-6 text-sm text-neutral-400">
                        <p>No active filters</p>
                        <p className="text-xs mt-1">Add a filter to narrow down your view</p>
                    </div>
                ) : (
                    activeFilters.map((filter, index) => {
                        const op = OPERATORS.find(o => o.value === filter.operator);
                        const needsValue = op?.needsValue ?? true;
                        return (
                            <div key={filter.id} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 group">
                                <span className="text-[11px] font-semibold text-neutral-400 w-[38px] text-right flex-shrink-0 uppercase tracking-wider">
                                    {index === 0 ? 'Where' : 'And'}
                                </span>

                                <div className="relative flex-shrink-0">
                                    <select
                                        className="appearance-none bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 pr-7 text-xs font-medium text-neutral-700 dark:text-neutral-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors min-w-[110px] cursor-pointer"
                                        value={filter.propertyId}
                                        onChange={e => updateFilter(databaseId, viewId, filter.id, { propertyId: e.target.value })}
                                    >
                                        {database.properties.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
                                </div>

                                <div className="relative flex-shrink-0">
                                    <select
                                        className="appearance-none bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 pr-7 text-xs font-medium text-neutral-700 dark:text-neutral-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors min-w-[120px] cursor-pointer"
                                        value={filter.operator}
                                        onChange={e => updateFilter(databaseId, viewId, filter.id, { operator: e.target.value as FilterOperator })}
                                    >
                                        {OPERATORS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
                                </div>

                                {needsValue && (
                                    <input
                                        className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 outline-none placeholder:text-neutral-400 focus:border-blue-400 dark:focus:border-blue-500 transition-colors min-w-0"
                                        placeholder="Type a value..."
                                        value={filter.value as string || ''}
                                        onChange={e => updateFilter(databaseId, viewId, filter.id, { value: e.target.value })}
                                        autoFocus={index === activeFilters.length - 1}
                                    />
                                )}

                                <button
                                    onClick={() => removeFilter(databaseId, viewId, filter.id)}
                                    className="p-1 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 rounded transition-all flex-shrink-0"
                                    title="Remove this filter"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]">
                <button onClick={handleAddFilter} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    Add filter rule
                </button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes filterFlyoutIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}} />
        </div>,
        document.body
    );

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => {
                    if (activeFilters.length === 0) handleAddFilter();
                    else setIsOpen(!isOpen);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-md transition-all ${
                    activeFilters.length > 0
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                        : isOpen
                            ? 'text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-white/10'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                }`}
            >
                <Filter className="w-3.5 h-3.5" />
                {t('db.toolbar.filter')}
                {activeFilters.length > 0 && (
                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-semibold">
                        {activeFilters.length}
                    </span>
                )}
            </button>
            {panel}
        </>
    );
}
