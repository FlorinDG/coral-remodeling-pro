"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '../store';
import { FilterOperator } from '../types';
import { Filter, X, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FilterToolbarProps {
    databaseId: string;
    viewId?: string;
}

const operators: { value: FilterOperator; label: string }[] = [
    { value: 'equals', label: 'Is' },
    { value: 'does_not_equal', label: 'Is not' },
    { value: 'contains', label: 'Contains' },
    { value: 'does_not_contain', label: 'Does not contain' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
];

export default function FilterToolbar({ databaseId, viewId }: FilterToolbarProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const addFilter = useDatabaseStore(state => state.addFilter);
    const updateFilter = useDatabaseStore(state => state.updateFilter);
    const removeFilter = useDatabaseStore(state => state.removeFilter);
    const clearFilters = useDatabaseStore(state => state.clearFilters);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const t = useTranslations('Admin');

    // Close when clicking outside the popover
    React.useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!popoverRef.current || popoverRef.current.contains(event.target as Node)) {
                return;
            }
            setIsOpen(false);
        };
        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);
        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, []);

    // Subscribe to store
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    if (!database) return null;

    const activeFilters = viewId
        ? database.views.find(v => v.id === viewId)?.filters || []
        : database.activeFilters || [];

    const handleAddFilter = () => {
        if (database.properties.length === 0) return;
        addFilter(databaseId, viewId, {
            propertyId: database.properties[0].id,
            operator: 'equals',
            value: ''
        });
        setIsOpen(true);
    };

    return (
        <div ref={popoverRef} className="relative flex items-center">

            {/* Top Bar Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        if (activeFilters.length === 0) handleAddFilter();
                        else setIsOpen(!isOpen);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition ${activeFilters.length > 0 || isOpen
                        ? 'text-blue-600'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                >
                    <Filter className="w-3.5 h-3.5" />
                    {t('db.toolbar.filter')}
                    {activeFilters.length > 0 && (
                        <span className="bg-blue-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                            {activeFilters.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Expanded Filter Panel */}
            {isOpen && activeFilters.length > 0 && (
                <div className="absolute top-[100%] right-0 mt-2 z-50 min-w-[340px] flex flex-col gap-2 p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 shadow-lg">
                    {activeFilters.map((filter, index) => (
                        <div key={filter.id} className="flex items-center gap-2 text-sm">
                            <span className="text-neutral-500 min-w-[50px]">
                            {index === 0 ? 'Where' : 'And'}
                            </span>

                            {/* Property Selector */}
                            <select
                                className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none min-w-[120px]"
                                value={filter.propertyId}
                                onChange={e => updateFilter(databaseId, viewId, filter.id, { propertyId: e.target.value })}
                            >
                                {database.properties.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>

                            {/* Operator Selector */}
                            <select
                                className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none min-w-[120px]"
                                value={filter.operator}
                                onChange={e => updateFilter(databaseId, viewId, filter.id, { operator: e.target.value as FilterOperator })}
                            >
                                {operators.map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>

                            {/* Value Input (Hidden if operator doesn't need it) */}
                            {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                                <input
                                    className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none min-w-[200px]"
                                    placeholder="Type a value..."
                                    value={filter.value as string || ''}
                                    onChange={e => updateFilter(databaseId, viewId, filter.id, { value: e.target.value })}
                                />
                            )}

                            {/* Remove Row */}
                            <button
                                onClick={() => removeFilter(databaseId, viewId, filter.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded ml-auto transition-colors"
                                title="Remove this rule"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}

                    <div className="flex items-center gap-4 mt-2 pl-[58px]">
                        <button
                            onClick={handleAddFilter}
                            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add rule
                        </button>
                        <button
                            onClick={() => {
                                clearFilters(databaseId, viewId);
                                setIsOpen(false);
                            }}
                            className="text-sm text-red-500 hover:text-red-600"
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
