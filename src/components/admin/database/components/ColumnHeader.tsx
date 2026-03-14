import React, { useState, useRef, useEffect } from 'react';
import { Property, PropertyType } from '../types';
import { useDatabaseStore } from '../store';
import { Settings2, Trash2, Edit3, Type, Hash, List, CheckSquare, Calendar, Link } from 'lucide-react';

const typeIcons: Record<PropertyType, React.ElementType> = {
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
    property: Property;
}

export default function ColumnHeader({ databaseId, property }: ColumnHeaderProps) {
    const updateProperty = useDatabaseStore(state => state.updateProperty);
    const deleteProperty = useDatabaseStore(state => state.deleteProperty);
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(property.name);
    const menuRef = useRef<HTMLDivElement>(null);

    const Icon = typeIcons[property.type] || Type;

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

    return (
        <div className="relative flex items-center w-full h-full group" ref={menuRef}>
            <button
                className="flex items-center gap-2 w-full text-left px-2 outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Icon className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-medium">{property.name}</span>
            </button>

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
}
