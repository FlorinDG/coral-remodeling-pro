"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '../store';
import { SortRule, SortDirection } from '../types';
import { ArrowUpDown, X, Plus } from 'lucide-react';

interface SortToolbarProps {
    databaseId: string;
}

const directions: { value: SortDirection; label: string }[] = [
    { value: 'ascending', label: 'Ascending' },
    { value: 'descending', label: 'Descending' }
];

export default function SortToolbar({ databaseId }: SortToolbarProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const addSort = useDatabaseStore(state => state.addSort);
    const updateSort = useDatabaseStore(state => state.updateSort);
    const removeSort = useDatabaseStore(state => state.removeSort);
    const clearSorts = useDatabaseStore(state => state.clearSorts);
    const [isOpen, setIsOpen] = useState(false);

    // Subscribe to store
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    if (!database) return null;

    const activeSorts = database.activeSorts || [];

    const handleAddSort = () => {
        if (database.properties.length === 0) return;

        // Prevent adding a sort for a property that is already being sorted
        const unassignedProps = database.properties.filter(p => !activeSorts.some(s => s.propertyId === p.id));
        if (unassignedProps.length === 0) return;

        addSort(databaseId, {
            propertyId: unassignedProps[0].id,
            direction: 'ascending'
        });
        setIsOpen(true);
    };

    return (
        <div className="flex-col flex px-4">

            {/* Top Bar Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        if (activeSorts.length === 0) handleAddSort();
                        else setIsOpen(!isOpen);
                    }}
                    className={`flex items-center gap-2 px-2 py-1 text-sm font-medium rounded-md transition-colors ${activeSorts.length > 0 || isOpen
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Sort
                    {activeSorts.length > 0 && (
                        <span className="bg-blue-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                            {activeSorts.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Expanded Sort Panel */}
            {isOpen && activeSorts.length > 0 && (
                <div className="absolute top-[100%] left-0 mt-2 z-10 min-w-[340px] flex flex-col gap-2 p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 shadow-lg">
                    {activeSorts.map((sort, index) => (
                        <div key={sort.id} className="flex items-center gap-2 text-sm">
                            <span className="text-neutral-500 min-w-[60px]">
                                {index === 0 ? 'Sort by' : 'Then by'}
                            </span>

                            {/* Property Selector */}
                            <select
                                className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none min-w-[120px] flex-1"
                                value={sort.propertyId}
                                onChange={e => updateSort(databaseId, sort.id, { propertyId: e.target.value })}
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

                            {/* Direction Selector */}
                            <select
                                className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none min-w-[110px]"
                                value={sort.direction}
                                onChange={e => updateSort(databaseId, sort.id, { direction: e.target.value as SortDirection })}
                            >
                                {directions.map(dir => (
                                    <option key={dir.value} value={dir.value}>{dir.label}</option>
                                ))}
                            </select>

                            {/* Remove Row */}
                            <button
                                onClick={() => removeSort(databaseId, sort.id)}
                                className="p-1 text-neutral-400 hover:text-red-500 rounded ml-auto"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    <div className="flex items-center gap-4 mt-2">
                        <button
                            onClick={handleAddSort}
                            disabled={activeSorts.length >= database.properties.length}
                            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-white disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add sort
                        </button>
                        <button
                            onClick={() => {
                                clearSorts(databaseId);
                                setIsOpen(false);
                            }}
                            className="text-sm text-red-500 hover:text-red-600 ml-auto mr-6"
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
