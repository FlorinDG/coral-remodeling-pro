"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDatabaseStore } from '../store';
import { SortDirection } from '../types';
import { ArrowUpDown, X, Plus, Trash2, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SortToolbarProps {
    databaseId: string;
    viewId?: string;
}

const DIRECTIONS: { value: SortDirection; label: string; icon: React.ReactNode }[] = [
    { value: 'ascending', label: 'Ascending', icon: <ArrowUp className="w-3 h-3" /> },
    { value: 'descending', label: 'Descending', icon: <ArrowDown className="w-3 h-3" /> }
];

export default function SortToolbar({ databaseId, viewId }: SortToolbarProps) {
    const addSort = useDatabaseStore(state => state.addSort);
    const updateSort = useDatabaseStore(state => state.updateSort);
    const removeSort = useDatabaseStore(state => state.removeSort);
    const clearSorts = useDatabaseStore(state => state.clearSorts);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const t = useTranslations('Admin');

    // Subscribe to store
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));

    const activeSorts = database
        ? (viewId
            ? database.views.find(v => v.id === viewId)?.sorts || []
            : database.activeSorts || [])
        : [];

    // Close when clicking outside
    useEffect(() => {
        if (!isOpen) return;
        const listener = (event: MouseEvent | TouchEvent) => {
            if (popoverRef.current?.contains(event.target as Node)) return;
            if (triggerRef.current?.contains(event.target as Node)) return;
            setIsOpen(false);
        };
        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);
        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    if (!database) return null;

    const handleAddSort = () => {
        if (database.properties.length === 0) return;
        const unassignedProps = database.properties.filter(p => !activeSorts.some(s => s.propertyId === p.id));
        if (unassignedProps.length === 0) return;
        addSort(databaseId, viewId, {
            propertyId: unassignedProps[0].id,
            direction: 'ascending'
        });
        setIsOpen(true);
    };

    const handleClearAll = () => {
        clearSorts(databaseId, viewId);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* ── Trigger Button ── */}
            <button
                ref={triggerRef}
                onClick={() => {
                    if (activeSorts.length === 0) handleAddSort();
                    else setIsOpen(!isOpen);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-md transition-all ${
                    activeSorts.length > 0
                        ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30'
                        : isOpen
                            ? 'text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-white/10'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                }`}
            >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {t('db.toolbar.sort')}
                {activeSorts.length > 0 && (
                    <span className="bg-purple-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-semibold">
                        {activeSorts.length}
                    </span>
                )}
            </button>

            {/* ── Flyout Panel ── */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute top-full right-0 mt-2 z-[100] w-[420px] bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-white/10 shadow-xl overflow-hidden"
                    style={{ animation: 'sortFlyoutIn 150ms ease-out' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-white/5">
                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                            {activeSorts.length > 0 ? `${activeSorts.length} active sort${activeSorts.length > 1 ? 's' : ''}` : 'Sort'}
                        </span>
                        <div className="flex items-center gap-2">
                            {activeSorts.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
                                >
                                    Clear all
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 rounded transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Sort Rules */}
                    <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                        {activeSorts.length === 0 ? (
                            <div className="text-center py-6 text-sm text-neutral-400">
                                <p>No active sorts</p>
                                <p className="text-xs mt-1">Add a sort to order your records</p>
                            </div>
                        ) : (
                            activeSorts.map((sort, index) => (
                                <div
                                    key={sort.id}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 group"
                                >
                                    {/* Conjunction */}
                                    <span className="text-[11px] font-semibold text-neutral-400 w-[50px] text-right flex-shrink-0 uppercase tracking-wider">
                                        {index === 0 ? t('db.toolbar.sortBy') : t('db.toolbar.thenBy')}
                                    </span>

                                    {/* Property selector */}
                                    <div className="relative flex-1">
                                        <select
                                            className="appearance-none w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 pr-7 text-xs font-medium text-neutral-700 dark:text-neutral-200 outline-none focus:border-purple-400 dark:focus:border-purple-500 transition-colors cursor-pointer"
                                            value={sort.propertyId}
                                            onChange={e => updateSort(databaseId, viewId, sort.id, { propertyId: e.target.value })}
                                        >
                                            {database.properties.map(p => (
                                                <option
                                                    key={p.id}
                                                    value={p.id}
                                                    disabled={activeSorts.some(s => s.propertyId === p.id && s.id !== sort.id)}
                                                >
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
                                    </div>

                                    {/* Direction selector */}
                                    <div className="relative flex-shrink-0">
                                        <select
                                            className="appearance-none bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 pr-7 text-xs font-medium text-neutral-700 dark:text-neutral-200 outline-none focus:border-purple-400 dark:focus:border-purple-500 transition-colors min-w-[110px] cursor-pointer"
                                            value={sort.direction}
                                            onChange={e => updateSort(databaseId, viewId, sort.id, { direction: e.target.value as SortDirection })}
                                        >
                                            {DIRECTIONS.map(dir => (
                                                <option key={dir.value} value={dir.value}>{dir.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
                                    </div>

                                    {/* Delete */}
                                    <button
                                        onClick={() => removeSort(databaseId, viewId, sort.id)}
                                        className="p-1 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 rounded transition-all flex-shrink-0"
                                        title="Remove this sort"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]">
                        <button
                            onClick={handleAddSort}
                            disabled={activeSorts.length >= database.properties.length}
                            className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add sort rule
                        </button>
                    </div>
                </div>
            )}

            {/* Micro-animation */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sortFlyoutIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}} />
        </div>
    );
}
