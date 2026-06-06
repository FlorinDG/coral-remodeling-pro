"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Type, Hash, Calendar, CheckSquare, List, Tag,
    Link2, Phone, Mail, Search, Calculator, Percent,
    Clock, User, Plus, X, Crown
} from 'lucide-react';
import { PropertyType } from '../types';
import { useTenant } from '@/context/TenantContext';

interface PropertyTypeOption {
    type: PropertyType;
    label: string;
    icon: React.ReactNode;
    category: string;
    enterpriseOnly?: boolean;
}

const PROPERTY_TYPES: PropertyTypeOption[] = [
    // Basic
    { type: 'text',         label: 'Text',           icon: <Type className="w-4 h-4" />,         category: 'Basic' },
    { type: 'number',       label: 'Number',         icon: <Hash className="w-4 h-4" />,         category: 'Basic' },
    { type: 'currency',     label: 'Currency',       icon: <Hash className="w-4 h-4" />,         category: 'Basic' },
    { type: 'percent',      label: 'Percent',        icon: <Percent className="w-4 h-4" />,      category: 'Basic' },
    // Selection
    { type: 'select',       label: 'Select',         icon: <List className="w-4 h-4" />,         category: 'Selection' },
    { type: 'multi_select', label: 'Multi-Select',   icon: <Tag className="w-4 h-4" />,          category: 'Selection' },
    { type: 'checkbox',     label: 'Checkbox',       icon: <CheckSquare className="w-4 h-4" />,  category: 'Selection' },
    // Date & Time
    { type: 'date',         label: 'Date',           icon: <Calendar className="w-4 h-4" />,     category: 'Date & Time' },
    // Links
    { type: 'url',          label: 'URL',            icon: <Link2 className="w-4 h-4" />,        category: 'Links' },
    { type: 'email',        label: 'Email',          icon: <Mail className="w-4 h-4" />,         category: 'Links' },
    { type: 'phone',        label: 'Phone',          icon: <Phone className="w-4 h-4" />,        category: 'Links' },
    // Advanced
    { type: 'relation',     label: 'Relation',       icon: <Search className="w-4 h-4" />,       category: 'Advanced' },
    { type: 'rollup',       label: 'Rollup',         icon: <Hash className="w-4 h-4" />,         category: 'Advanced' },
    { type: 'formula',      label: 'Formula',        icon: <Calculator className="w-4 h-4" />,   category: 'Advanced', enterpriseOnly: true },
    // Meta
    { type: 'created_time',      label: 'Created Time',      icon: <Clock className="w-4 h-4" />, category: 'Meta' },
    { type: 'last_edited_time',  label: 'Last Edited Time',  icon: <Clock className="w-4 h-4" />, category: 'Meta' },
    { type: 'created_by',        label: 'Created By',        icon: <User className="w-4 h-4" />,  category: 'Meta' },
    { type: 'last_edited_by',    label: 'Last Edited By',    icon: <User className="w-4 h-4" />,  category: 'Meta' },
];

interface AddColumnFlyoutProps {
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: PropertyType) => void;
}

export default function AddColumnFlyout({ anchorRef, isOpen, onClose, onAdd }: AddColumnFlyoutProps) {
    const { isEnterprise } = useTenant();
    const [search, setSearch] = useState('');
    const [pos, setPos] = useState<{ top: number; left: number; placement: 'bottom' | 'top' } | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const updatePos = useCallback(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const placement = spaceBelow < 430 && rect.top > spaceBelow ? 'top' : 'bottom';
            setPos({
                top: placement === 'top' ? rect.top - 6 : rect.bottom + 6,
                left: Math.min(rect.left, window.innerWidth - 280),
                placement
            });
        }
    }, [anchorRef]);

    useEffect(() => {
        if (!isOpen) { setSearch(''); return; }
        updatePos();
        // Focus the search input
        setTimeout(() => inputRef.current?.focus(), 50);
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [isOpen, updatePos]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            onClose();
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen || !pos) return null;

    const filtered = PROPERTY_TYPES.filter(pt =>
        pt.label.toLowerCase().includes(search.toLowerCase())
    );

    // Group by category
    const categories = Array.from(new Set(filtered.map(pt => pt.category)));

    return createPortal(
        <div
            ref={panelRef}
            className="fixed w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            style={pos.placement === 'top'
                ? { bottom: window.innerHeight - pos.top, left: pos.left, zIndex: 99999, maxHeight: '420px' }
                : { top: pos.top, left: pos.left, zIndex: 99999, maxHeight: '420px' }
            }
        >
            {/* Search */}
            <div className="p-2.5 border-b border-neutral-100 dark:border-white/5">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter property type..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-400 dark:focus:border-orange-500 transition-colors text-neutral-900 dark:text-white placeholder:text-neutral-400"
                    />
                </div>
            </div>

            {/* Types list */}
            <div className="overflow-y-auto custom-scrollbar p-1.5 flex-1">
                {categories.map(cat => {
                    const items = filtered.filter(pt => pt.category === cat);
                    if (!items.length) return null;

                    return (
                        <div key={cat} className="mb-1 last:mb-0">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                {cat}
                            </div>
                            {items.map(pt => {
                                const locked = pt.enterpriseOnly && !isEnterprise;
                                return (
                                    <button
                                        key={pt.type}
                                        onClick={() => {
                                            if (locked) return;
                                            onAdd(pt.type);
                                            onClose();
                                        }}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                                            locked
                                                ? 'opacity-50 cursor-not-allowed'
                                                : 'hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer'
                                        }`}
                                    >
                                        <span className="text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                                            {pt.icon}
                                        </span>
                                        <span className="text-neutral-800 dark:text-neutral-200 flex-1 text-left truncate">
                                            {pt.label}
                                        </span>
                                        {pt.enterpriseOnly && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 flex-shrink-0">
                                                <Crown className="w-2.5 h-2.5" />
                                                Enterprise
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="p-4 text-center text-xs text-neutral-400">
                        No matching types
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
