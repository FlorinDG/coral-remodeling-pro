import React, { useState, useRef, useEffect } from 'react';
import { Property, PropertyType } from '../types';
import { useDatabaseStore } from '../store';
import { Settings2, Trash2, Edit3, Type, Hash, List, CheckSquare, Calendar, Link, Euro, Percent } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

const typeIcons: Record<string, React.ElementType> = {
    text: Type,
    number: Hash,
    select: List,
    multi_select: List,
    date: Calendar,
    checkbox: CheckSquare,
    url: Link,
    email: Link,
    phone: Hash,
    relation: Link,
    rollup: Link,
    formula: Settings2,
    currency: Euro,
    percent: Percent,
    person: UserIcon,
    created_time: Calendar,
    created_by: UserIcon,
    last_edited_time: Calendar,
    last_edited_by: UserIcon
};

function UserIcon(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}

interface ColumnHeaderProps {
    databaseId: string;
    viewId?: string; // Essential for scoped dimensions
    property: Property;
    index?: number;  // The column's current active visual index 
    onLiveResize?: (width: number) => void;
    onLiveResizeEnd?: () => void;
}

export default function ColumnHeader({ databaseId, viewId, property, index = 0, onLiveResize, onLiveResizeEnd }: ColumnHeaderProps) {
    const database = useDatabaseStore(state => state.getDatabase(databaseId));
    const updateProperty = useDatabaseStore(state => state.updateProperty);
    const deleteProperty = useDatabaseStore(state => state.deleteProperty);
    const { activeModules } = useTenant();
    const hasDatabases = activeModules.includes('DATABASES');
    const isImmutableContactDB = databaseId === 'db-clients' || databaseId === 'db-suppliers';
    const canEditSchema = !isImmutableContactDB || hasDatabases;

    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(property.name);
    const menuRef = useRef<HTMLDivElement>(null);

    const Icon = typeIcons[property.type] || Type;

    const activeView = database?.views?.find(v => v.id === viewId);
    const propertyState = activeView?.propertiesState?.find(p => p.propertyId === property.id);
    const updateViewPropertyState = useDatabaseStore(state => state.updateViewPropertyState);

    // Provide a sensible default starting width if undefined
    const [localWidth, setLocalWidth] = useState(propertyState?.width || 150);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);

    // Sync from upper state if external change happens
    useEffect(() => {
        if (propertyState?.width !== undefined) {
            setLocalWidth(propertyState.width);
        }
    }, [propertyState?.width]);

    // Handle outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsEditing(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRename = () => {
        if (name !== property.name) {
            updateProperty(databaseId, property.id, { name });
        }
        setIsEditing(false);
        setIsOpen(false);
    };

    // Resizing Logic
    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Stop sorting/menu trigger
        setIsResizing(true);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = localWidth;

        document.documentElement.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const diff = moveEvent.clientX - resizeStartX.current;
            const newWidth = Math.max(60, resizeStartWidth.current + diff); // Min width 60px
            setLocalWidth(newWidth);
            onLiveResize?.(newWidth);
        };

        const handlePointerUp = (upEvent: PointerEvent) => {
            const finalDiff = upEvent.clientX - resizeStartX.current;
            const finalWidth = Math.max(60, resizeStartWidth.current + finalDiff);

            // Commit to global view state
            if (viewId) {
                updateViewPropertyState(databaseId, viewId, property.id, { width: finalWidth });
            }

            setIsResizing(false);
            onLiveResizeEnd?.();
            document.documentElement.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const innerContent = (
        <div
            className={`relative flex items-center h-full group ${isResizing ? 'bg-neutral-100 dark:bg-white/5' : ''}`}
            ref={menuRef}
            style={{ width: '100%' }} // Flex layout handles actual sizing, we just stretch to fit
        >
            <div className="flex items-center gap-1.5 w-full h-full px-2">

                <button
                    className={`flex items-center gap-1.5 w-full h-full text-left outline-none ${canEditSchema ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => {
                        if (!canEditSchema) return;
                        setIsOpen(!isOpen);
                    }}
                    onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!canEditSchema) return;
                        setIsOpen(true);
                        setIsEditing(true);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!canEditSchema) return;
                        setIsOpen(true);
                    }}
                >
                    <Icon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <span className="font-medium truncate flex-1 select-none pointer-events-none">{property.name}</span>
                </button>
            </div>

            {/* Resize Handle overlaying the right border edge */}
            <div
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 hover:opacity-100 opacity-0 z-10 transition-colors ${isResizing ? 'bg-blue-500 opacity-100' : ''}`}
                onPointerDown={handleResizeStart}
            />

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 rounded-md shadow-lg border border-neutral-200 dark:border-white/10 z-50 p-1 flex flex-col gap-1 text-sm font-normal">
                    {isEditing ? (
                        <div className="p-1 px-2">
                            <input
                                autoFocus
                                className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRename()}
                                onBlur={handleRename}
                            />
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 rounded text-neutral-700 dark:text-neutral-200"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                Rename
                            </button>
                            <div className="w-full h-px bg-neutral-200 dark:bg-white/10 my-1" />
                            <button
                                onClick={() => {
                                    deleteProperty(databaseId, property.id);
                                    setIsOpen(false);
                                }}
                                className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Property
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );

    return innerContent;
}
