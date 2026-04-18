import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDatabaseStore } from '../store';
import { Settings2, Eye, EyeOff, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useTranslations } from 'next-intl';

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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
    const t = useTranslations('Admin');

    // Position the panel relative to the button
    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPanelPos({
                top: rect.bottom + 6,
                left: Math.max(8, rect.right - 256), // 256 = w-64, keep on screen
            });
        }
    }, []);

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

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (buttonRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setIsOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!database || !activeView) return null;

    const propertiesStateMap = new Map(activeView.propertiesState?.map(ps => [ps.propertyId, ps]) || []);

    const sortedProperties = [...database.properties].sort((a, b) => {
        const orderA = propertiesStateMap.get(a.id)?.order ?? 999;
        const orderB = propertiesStateMap.get(b.id)?.order ?? 999;
        return orderA - orderB;
    });

    const togglePropertyVisibility = (propertyId: string) => {
        const currentState = propertiesStateMap.get(propertyId);
        const isCurrentlyHidden = !!currentState?.hidden;
        if (propertyId === 'title') return;
        updateViewPropertyState(databaseId, viewId, propertyId, { hidden: !isCurrentlyHidden });
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;
        updateViewPropertyOrder(databaseId, viewId, result.source.index, result.destination.index);
    };

    const panel = isOpen && panelPos && typeof document !== 'undefined' && createPortal(
        <div
            ref={panelRef}
            className="fixed w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            style={{ top: panelPos.top, left: panelPos.left, zIndex: 99999 }}
        >
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
                                                            {t.has('db.col.' + prop.id) ? t('db.col.' + prop.id as any) : prop.name}
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
        </div>,
        document.body
    );

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition ${isOpen ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
            >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t('db.toolbar.properties')}</span>
            </button>
            {panel}
        </>
    );
}
