'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export interface CustomDatePickerProps {
    value?: string;
    onChange: (date: string) => void;
    min?: string;
    placeholder?: string;
    clearable?: boolean;
    customTrigger?: React.ReactNode;
    triggerClassName?: string;
}

function formatDateDisplay(isoString?: string) {
    if (!isoString) return 'Select date';
    const d = new Date(isoString + 'T00:00:00');
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function CustomDatePicker({ value, onChange, min, placeholder = 'Select date', clearable = true, customTrigger, triggerClassName }: CustomDatePickerProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const parsedDate = value ? new Date(value) : null;
    const initialYear = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : new Date().getFullYear();
    const initialMonth = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : new Date().getMonth();

    const [currentYear, setCurrentYear] = useState(initialYear);
    const [currentMonth, setCurrentMonth] = useState(initialMonth);

    const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);

    const updatePosition = () => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const popoverHeight = 360;

        let placement: 'top' | 'bottom' = 'bottom';
        if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
            placement = 'top';
        }

        setPos({
            top: placement === 'bottom' ? rect.bottom + 8 : rect.top - 8,
            left: rect.left,
            placement
        });
    };

    useLayoutEffect(() => {
        if (open) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, { capture: true });
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, { capture: true });
            };
        }
    }, [open]);

    useEffect(() => {
        const clickAway = (e: MouseEvent) => {
            const popover = document.querySelector('[data-datepicker-popover="true"]');
            if (
                ref.current && !ref.current.contains(e.target as Node) &&
                popover && !popover.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        if (open) {
            document.addEventListener('mousedown', clickAway, true);
            document.addEventListener('keydown', handleKeyDown, true);
        }
        return () => {
            document.removeEventListener('mousedown', clickAway, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [open]);

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    const handleSelectDay = (dayObj: { day: number; isCurrentMonth: boolean; monthOffset: number; isPast: boolean }, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dayObj.isPast) return;

        let targetYear = currentYear;
        let targetMonth = currentMonth + dayObj.monthOffset;

        if (targetMonth < 0) {
            targetMonth = 11;
            targetYear--;
        } else if (targetMonth > 11) {
            targetMonth = 0;
            targetYear++;
        }

        const d = new Date(targetYear, targetMonth, dayObj.day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onChange('');
        setOpen(false);
    };

    // Calendar logic
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    const minDateStr = min ? min : '';

    const days = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const dStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({
            day: d,
            isCurrentMonth: false,
            monthOffset: -1,
            dateStr: dStr,
            isPast: minDateStr ? dStr < minDateStr : false,
        });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        days.push({
            day: i,
            isCurrentMonth: true,
            monthOffset: 0,
            dateStr: dStr,
            isPast: minDateStr ? dStr < minDateStr : false,
        });
    }

    // Next month days to complete grid (42 cells = 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        const targetYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const targetMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const dStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        days.push({
            day: i,
            isCurrentMonth: false,
            monthOffset: 1,
            dateStr: dStr,
            isPast: minDateStr ? dStr < minDateStr : false,
        });
    }

    const monthName = new Date(currentYear, currentMonth).toLocaleString(undefined, { month: 'long' });
    const isSelected = (dayObj: typeof days[0]) => dayObj.dateStr === value;

    return (
        <div ref={ref} className={`relative inline-block ${triggerClassName || 'w-full sm:w-auto'}`}>
            {customTrigger ? (
                <div onClick={() => setOpen(!open)}>{customTrigger}</div>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-white/10 text-xs font-bold hover:border-orange-400 dark:hover:border-orange-500/50 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-all bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 shadow-sm active:scale-98"
                >
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                        <span>{value ? formatDateDisplay(value) : placeholder}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500 opacity-60" />
                </button>
            )}

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    data-datepicker-popover="true"
                    className="fixed z-[99999] bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border border-neutral-300 dark:border-white/10 rounded-2xl shadow-2xl p-4 w-72 select-none animate-in fade-in slide-in-from-top-1 duration-150"
                    style={pos.placement === 'top'
                        ? { bottom: window.innerHeight - pos.top, left: pos.left }
                        : { top: pos.top, left: pos.left }
                    }
                >
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-neutral-900 dark:text-white">
                            {monthName} {currentYear}
                        </span>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-center text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map((d, index) => {
                            const today = d.dateStr === todayStr;
                            const selected = isSelected(d);
                            const disabled = d.isPast;

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    disabled={disabled}
                                    onClick={(e) => handleSelectDay(d, e)}
                                    className={`
                                        aspect-square flex items-center justify-center rounded-lg text-xs font-semibold transition-all relative
                                        ${!d.isCurrentMonth ? 'text-neutral-350 dark:text-neutral-600 opacity-60' : 'text-neutral-800 dark:text-neutral-200'}
                                        ${selected 
                                            ? 'bg-[var(--brand-color,#d35400)] text-white font-extrabold shadow-sm hover:bg-[var(--brand-color,#d35400)]/90' 
                                            : 'hover:bg-neutral-100 dark:hover:bg-white/10'
                                        }
                                        ${disabled ? 'opacity-25 cursor-not-allowed pointer-events-none' : ''}
                                        ${today && !selected ? 'border border-[var(--brand-color,#d35400)]/50 text-[var(--brand-color,#d35400)]' : ''}
                                    `}
                                >
                                    {d.day}
                                </button>
                            );
                        })}
                    </div>

                    {clearable && value && (
                        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-white/10 flex justify-end">
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs font-bold text-red-650 hover:text-red-750 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            >
                                Clear Date
                            </button>
                        </div>
                    )}
                </div>
            , document.body)}
        </div>
    );
}
