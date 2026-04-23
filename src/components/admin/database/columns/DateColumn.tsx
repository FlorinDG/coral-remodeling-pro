import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { CellProps, Column } from 'react-datasheet-grid';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
}

function isToday(year: number, month: number, day: number) {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

/** Normalise any date value stored in the DB to a plain YYYY-MM-DD string. */
function normaliseDateValue(raw: string): string {
    if (!raw) return '';
    // Already a clean YYYY-MM-DD? Return as-is.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // Full ISO-8601 with 'T' (e.g. 2026-02-20T23:00:00.000Z) → strip time.
    if (raw.includes('T')) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    // European DD/MM/YYYY or DD-MM-YYYY
    const euMatch = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (euMatch) return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
    // US MM/DD/YYYY
    const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
        const m = parseInt(usMatch[1]), d = parseInt(usMatch[2]);
        if (m > 12) return `${usMatch[3]}-${usMatch[2].padStart(2, '0')}-${usMatch[1].padStart(2, '0')}`; // actually DD/MM
        return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
    }
    // Fallback: try native Date parse
    const fallback = new Date(raw);
    if (!isNaN(fallback.getTime())) {
        return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
    }
    return raw;
}

function formatDisplayDate(dateStr: string) {
    if (!dateStr) return '';
    const normalised = normaliseDateValue(dateStr);
    const d = new Date(normalised + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface CalendarPickerProps {
    value: string;
    onChange: (val: string) => void;
    onClose: () => void;
    anchorRect: DOMRect;
}

const CalendarPicker = ({ value, onChange, onClose, anchorRect }: CalendarPickerProps) => {
    const normVal = value ? normaliseDateValue(value) : '';
    const parsed = normVal ? new Date(normVal + 'T00:00:00') : new Date();
    const [viewYear, setViewYear] = useState(parsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed.getMonth());
    const panelRef = useRef<HTMLDivElement>(null);

    const selectedYear = value ? parsed.getFullYear() : null;
    const selectedMonth = value ? parsed.getMonth() : null;
    const selectedDay = value ? parsed.getDate() : null;

    // Close on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

    // Prev month trailing days
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);
    const trailingDays = Array.from({ length: firstDay }, (_, i) => ({
        day: prevMonthDays - firstDay + i + 1,
        outside: true,
        month: viewMonth - 1,
        year: viewMonth === 0 ? viewYear - 1 : viewYear,
    }));

    // Current month days
    const currentDays = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        outside: false,
        month: viewMonth,
        year: viewYear,
    }));

    // Next month leading days
    const totalCells = trailingDays.length + currentDays.length;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const leadingDays = Array.from({ length: remainingCells }, (_, i) => ({
        day: i + 1,
        outside: true,
        month: viewMonth + 1,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
    }));

    const allDays = [...trailingDays, ...currentDays, ...leadingDays];

    const goToPrevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };
    const goToNextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };
    const goToToday = () => {
        const now = new Date();
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        onChange(dateStr);
    };

    const selectDay = (d: typeof allDays[0]) => {
        const y = d.month < 0 ? d.year : d.month > 11 ? d.year : d.year;
        const m = ((d.month % 12) + 12) % 12;
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
        onChange(dateStr);
        // Delay close so the grid commits the value before stopEditing
        setTimeout(() => onClose(), 0);
    };

    // Position: below the cell, or above if not enough space
    const top = anchorRect.bottom + 6;
    const left = Math.max(8, anchorRect.left);

    return createPortal(
        <div
            ref={panelRef}
            className="fixed bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
            style={{ top, left, zIndex: 99999, width: 280 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <button onClick={goToPrevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {MONTHS[viewMonth]} {viewYear}
                </div>
                <button onClick={goToNextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-3 pb-1">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 px-3 pb-2 gap-y-0.5">
                {allDays.map((d, i) => {
                    const isSelected = !d.outside && selectedYear === d.year && selectedMonth === d.month && selectedDay === d.day;
                    const isTodayDate = !d.outside && isToday(d.year, d.month, d.day);

                    return (
                        <button
                            key={i}
                            onClick={() => selectDay(d)}
                            className={`
                                w-full aspect-square rounded-lg text-sm font-medium transition-all duration-100
                                flex items-center justify-center
                                ${d.outside
                                    ? 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                                    : isSelected
                                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-sm'
                                        : isTodayDate
                                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-200 dark:ring-blue-500/30'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                }
                            `}
                        >
                            {d.day}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-black/20">
                <button
                    onClick={goToToday}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10"
                >
                    Today
                </button>
                {value && (
                    <button
                        onClick={() => { onChange(''); onClose(); }}
                        className="text-xs font-medium text-neutral-400 hover:text-red-500 transition px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        Clear
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
};

// ─── Grid Cell Component ────────────────────────────────
const DateComponent = ({ rowData, setRowData, focus, active, stopEditing }: CellProps<string | null, any>) => {
    const cellRef = useRef<HTMLDivElement>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const value = rowData ? normaliseDateValue(rowData) : '';

    useLayoutEffect(() => {
        if ((focus || active) && cellRef.current) {
            setRect(cellRef.current.getBoundingClientRect());
            setShowPicker(true);
        }
    }, [focus, active]);

    // Keep position updated
    useEffect(() => {
        if (!showPicker) return;
        const update = () => {
            if (cellRef.current) setRect(cellRef.current.getBoundingClientRect());
        };
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [showPicker]);

    const handleClose = useCallback(() => {
        setShowPicker(false);
    }, []);

    // Passive display mode
    if (!focus && !active) {
        return (
            <div ref={cellRef} className="w-full h-full p-2 flex items-center text-sm">
                {!value ? (
                    <span className="text-neutral-400">Empty</span>
                ) : (
                    <span className="text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {formatDisplayDate(value)}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div ref={cellRef} className="w-full h-full p-2 flex items-center text-sm border border-blue-500 rounded-sm bg-white dark:bg-neutral-900">
            <span className="text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                {value ? formatDisplayDate(value) : <span className="text-neutral-400">Pick a date...</span>}
            </span>
            {showPicker && rect && typeof document !== 'undefined' && (
                <CalendarPicker
                    value={value}
                    onChange={(val) => setRowData(val || null)}
                    onClose={handleClose}
                    anchorRect={rect}
                />
            )}
        </div>
    );
};

export const dateColumn: Column<string | null, any> = {
    component: DateComponent,
    keepFocus: true,
    disableKeys: true,
    deleteValue: () => null,
    copyValue: ({ rowData }) => rowData || '',
    pasteValue: ({ value }) => {
        return normaliseDateValue(value) || null;
    },
    isCellEmpty: ({ rowData }) => !rowData,
};
