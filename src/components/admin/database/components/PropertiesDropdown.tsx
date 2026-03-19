import React, { useState, useRef, useEffect } from 'react';
import { useDatabaseStore } from '../store';
import { Settings2, Eye, EyeOff, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface PropertiesDropdownProps {
    databaseId: string;
    viewId: string;
}

export default function PropertiesDropdown({ databaseId, viewId }: PropertiesDropdownProps) {
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const activeView = database?.views?.find(v => v.id === viewId);
    const updateViewPropertyState = useDatabaseStore(state => state.updateViewPropertyState);
    const updateViewPropertyOrder = useDatabaseStore(state => state.updateViewPropertyOrder);

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    if (!database || !activeView) return null;

    const propertiesStateMap = new Map(activeView.propertiesState?.map(ps => [ps.propertyId, ps]) || []);

    // Combine global schema with view state to figure out what's what
    const sortedProperties = [...database.properties].sort((a, b) => {
        const orderA = propertiesStateMap.get(a.id)?.order ?? 999;
        const orderB = propertiesStateMap.get(b.id)?.order ?? 999;
        return orderA - orderB;
    });

    const togglePropertyVisibility = (propertyId: string) => {
        const currentState = propertiesStateMap.get(propertyId);
        const isCurrentlyHidden = !!currentState?.hidden;

        // Cannot hide title, block it if it's the title property
        if (propertyId === 'title') return;

        updateViewPropertyState(databaseId, viewId, propertyId, { hidden: !isCurrentlyHidden });
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;

        updateViewPropertyOrder(
            databaseId,
            viewId,
            result.source.index,
            result.destination.index
        );
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition shadow-sm border ${isOpen ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-white/20 text-neutral-900 dark:text-white' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/80'}`}
            >
                <Settings2 className="w-4 h-4" />
                <span className="hidden md:inline">Properties</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-black/20">
                        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Shown in view</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Toggle and reorder columns.</p>
                    </div>

                    <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="properties-dropdown-list">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-0.5"
                                    >
                                        {sortedProperties.map((prop, index) => {
                                            const state = propertiesStateMap.get(prop.id);
                                            const isHidden = !!state?.hidden;
                                            const isTitle = prop.id === 'title';

                                            return (
                                                <Draggable key={prop.id} draggableId={prop.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`flex items-center justify-between p-1.5 rounded-lg text-sm transition ${snapshot.isDragging ? 'bg-white dark:bg-neutral-800 shadow-lg ring-1 ring-neutral-200 dark:ring-white/20' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing rounded"
                                                                >
                                                                    <GripVertical size={14} />
                                                                </div>
                                                                <span className={`truncate ${isHidden ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-700 dark:text-neutral-200'} ${isTitle ? 'font-medium' : ''}`}>
                                                                    {prop.name}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => togglePropertyVisibility(prop.id)}
                                                                disabled={isTitle}
                                                                className={`p-1 rounded-md transition ${isTitle ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                                                            >
                                                                {isHidden ? (
                                                                    <EyeOff size={16} className="text-neutral-400 dark:text-neutral-500" />
                                                                ) : (
                                                                    <Eye size={16} className="text-blue-500 dark:text-blue-400" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                </div>
            )}
        </div>
    );
}
