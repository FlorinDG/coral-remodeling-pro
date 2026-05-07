"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { COLOR_STYLES } from '../columns/SelectColumn';
import { SelectOption } from '../types';

interface SelectDropdownProps {
    value: string | null;
    options: SelectOption[];
    onChange: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Compact mode for inline engine header usage */
    compact?: boolean;
}

/**
 * Standard styled select dropdown used across the entire app.
 * Replaces all native <select> elements for single-select properties.
 * Matches the visual design of the NotionGrid's SelectColumn dropdown.
 */
export default function SelectDropdown({ value, options, onChange, placeholder = '—', disabled, compact }: SelectDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

    const selected = options.find(o => o.id === value);
    const styles = selected ? (COLOR_STYLES[selected.color] || COLOR_STYLES.gray) : null;

    useLayoutEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - 220);
            setPos({
                top: rect.bottom + 4,
                left,
                minWidth: Math.max(rect.width, 200),
            });
        } else {
            setPos(null);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
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

    const handleSelect = (optId: string | null) => {
        onChange(optId);
        setIsOpen(false);
    };

    return (
        <>
            <div
                ref={triggerRef}
                onClick={() => !disabled && setIsOpen(v => !v)}
                className={`flex items-center gap-1.5 cursor-pointer select-none ${compact ? '' : 'w-full min-h-[22px]'} ${disabled ? 'opacity-50 cursor-default' : ''}`}
            >
                {selected && styles ? (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${styles.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} flex-shrink-0`} />
                        {selected.name}
                    </span>
                ) : (
                    <span className="text-neutral-400 text-xs italic">{placeholder}</span>
                )}
                {!disabled && (
                    <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </div>

            {isOpen && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[99999] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-100 dark:border-neutral-700/80 py-1.5 overflow-hidden"
                    style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
                    onMouseDown={e => e.preventDefault()}
                >
                    {/* Empty / clear option */}
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelect(null);
                        }}
                    >
                        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            {!value && <Check className="w-3 h-3 text-neutral-400" />}
                        </span>
                        <span className="text-xs text-neutral-400 italic font-medium">Empty</span>
                    </button>

                    {options.length > 0 && (
                        <div className="h-px bg-neutral-100 dark:bg-neutral-800 mx-2 my-0.5" />
                    )}

                    {options.map(choice => {
                        const c = COLOR_STYLES[choice.color] || COLOR_STYLES.gray;
                        const isSelected = choice.id === value;
                        return (
                            <button
                                key={choice.id}
                                className={`w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${isSelected ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect(choice.id);
                                }}
                            >
                                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                    {isSelected && <Check className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${c.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                                    {choice.name}
                                </span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </>
    );
}
