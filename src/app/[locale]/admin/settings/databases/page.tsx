'use client';

import React, { useEffect, useState } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database as DatabaseIcon, Tag, Boxes, Settings2, GripVertical } from 'lucide-react';
import Link from 'next/link';
import ModuleTabs from '@/components/admin/ModuleTabs';
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export default function DatabaseListSettingsPage() {
    const databases = useDatabaseStore(state => state.databases);
    const updateDatabaseOrder = useDatabaseStore(state => state.updateDatabaseOrder);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const checkHydration = () => {
            if (useDatabaseStore.persist.hasHydrated()) {
                setIsHydrated(true);
            }
        };
        checkHydration();
        const unsub = useDatabaseStore.persist.onFinishHydration(() => {
            setIsHydrated(true);
        });
        return unsub;
    }, []);

    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;
        updateDatabaseOrder(result.source.index, result.destination.index);
    };

    if (!isHydrated) return <div className="p-8"><div className="w-full h-32 bg-neutral-100 dark:bg-white/5 animate-pulse rounded-xl" /></div>;

    const filteredDbs = databases.filter(db => !db.isTemplate);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="w-full flex-1 overflow-y-auto p-6 pb-16">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-col gap-2 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xl">
                                    <DatabaseIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Global Databases Schema</h1>
                                    <p className="text-sm text-neutral-500">Architectural properties, relationships, and data structure.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Database Registry</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">Drag rows to reorder how they appear in sidebar modules.</p>
                            </div>
                        </div>

                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="databases-list">
                                {(provided) => (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-neutral-50 dark:bg-black/40 border-b border-neutral-200 dark:border-white/10">
                                                <tr>
                                                    <th className="w-10 px-4 py-3"></th>
                                                    <th className="w-8 py-3"></th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Database Name</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 w-[150px]">ID</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 hidden lg:table-cell">Properties</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Description</th>
                                                    <th className="w-10 px-4 py-3 text-right"></th>
                                                </tr>
                                            </thead>
                                            <tbody
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className="divide-y divide-neutral-100 dark:divide-white/5"
                                            >
                                                {filteredDbs.map((db, index) => (
                                                    <Draggable key={db.id} draggableId={db.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <tr
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`group transition-colors ${snapshot.isDragging ? 'bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-neutral-200 dark:ring-white/20 rounded-xl z-50' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.02]'}`}
                                                                style={{
                                                                    ...provided.draggableProps.style,
                                                                    display: snapshot.isDragging ? 'table' : 'table-row'
                                                                }}
                                                            >
                                                                <td className="px-4 py-3">
                                                                    <div
                                                                        {...provided.dragHandleProps}
                                                                        className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing"
                                                                    >
                                                                        <GripVertical className="w-4 h-4" />
                                                                    </div>
                                                                </td>
                                                                <td className="py-3">
                                                                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                                        {db.icon ? (
                                                                            <span className="text-base">{db.icon}</span>
                                                                        ) : (
                                                                            <Boxes className="w-4 h-4" />
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-col">
                                                                        <Link href={`/admin/settings/databases/${db.id}`} className="font-bold text-neutral-900 dark:text-neutral-100 hover:text-blue-600 transition-colors">
                                                                            {db.name}
                                                                        </Link>
                                                                        <span className="text-[10px] text-neutral-500 font-mono opacity-60 lg:hidden">ID: {db.id}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 font-mono text-[10px] text-neutral-500 opacity-60 whitespace-nowrap">
                                                                    {db.id}
                                                                </td>
                                                                <td className="px-4 py-3 hidden lg:table-cell">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Tag className="w-3 h-3 text-neutral-400" />
                                                                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{db.properties.length}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
                                                                        {db.description || 'No description provided.'}
                                                                    </p>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Link
                                                                        href={`/admin/settings/databases/${db.id}`}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-white/5 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                                                                    >
                                                                        <Settings2 className="w-3.5 h-3.5" />
                                                                        <span className="hidden sm:inline">Schema</span>
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>

                    <div className="p-8 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 border-dashed flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-400 mb-4 shadow-sm">
                            <Settings2 className="w-8 h-8 -rotate-90" />
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Architectural Foundation</h3>
                        <p className="text-sm text-neutral-500 max-w-md">The core schemas defined here power the relations, calculations, and financial logic of the entire platform.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
