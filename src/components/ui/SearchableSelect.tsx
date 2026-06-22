"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyLabel?: string;
    className?: string;
    disabled?: boolean;
    borderless?: boolean;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    emptyLabel = 'No options found',
    className = '',
    disabled = false,
    borderless = false,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; placement: 'bottom' | 'top' } | null>(null);

    // Calculate position and handle responsive resize/scroll repositioning
    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const updatePosition = () => {
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const left = Math.max(10, Math.min(rect.left, window.innerWidth - 220));
                const spaceBelow = window.innerHeight - rect.bottom;
                const placement = spaceBelow < 250 && rect.top > spaceBelow ? 'top' : 'bottom';
                setPos({
                    top: placement === 'top' ? rect.top - 4 : rect.bottom + 4,
                    left,
                    minWidth: Math.max(rect.width, 200),
                    placement
                });
            };

            updatePosition();

            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, { capture: true, passive: true });

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, { capture: true });
            };
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPos(null);
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    // Auto-focus search when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(q));
    }, [options, search]);

    const selectedLabel = options.find(o => o.value === value)?.label;

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
                className={borderless ? `w-full flex items-center justify-between bg-transparent border-none px-1.5 py-1.5 text-xs font-semibold outline-none transition-all ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }` : `w-full flex items-center justify-between bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
                    isOpen ? 'ring-2 ring-orange-500/20 border-orange-500' : ''
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-neutral-300 dark:hover:border-white/20 cursor-pointer'}`}
            >
                <span className={selectedLabel ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}>
                    {selectedLabel || placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {value && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(''); setIsOpen(false); } }}
                            className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="fixed z-[99999] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5 dark:ring-white/5"
                    style={pos.placement === 'top'
                        ? { bottom: window.innerHeight - pos.top, left: pos.left, minWidth: pos.minWidth }
                        : { top: pos.top, left: pos.left, minWidth: pos.minWidth }
                    }
                >
                    {/* Search input */}
                    {options.length > 5 && (
                        <div className="p-2 border-b border-neutral-100 dark:border-white/5">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-500/20 transition-colors text-neutral-900 dark:text-white placeholder:text-neutral-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* Options list */}
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-neutral-400 italic">{emptyLabel}</div>
                        ) : (
                            filtered.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                        option.value === value
                                            ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 font-semibold'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
