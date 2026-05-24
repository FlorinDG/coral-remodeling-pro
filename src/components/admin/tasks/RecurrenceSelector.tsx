import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

// Helper functions for Advanced Recurrence
export function parseRecurrenceString(recurStr: string) {
    if (!recurStr) return { pattern: 'none', interval: 1, dayOfWeek: 1, customUnit: 'days' };
    const s = recurStr.trim().toLowerCase();
    if (s === 'every day' || s === 'daily') return { pattern: 'daily', interval: 1, dayOfWeek: 1, customUnit: 'days' };
    if (s === 'every weekday' || s === 'weekdays') return { pattern: 'weekdays', interval: 1, dayOfWeek: 1, customUnit: 'days' };
    if (s === 'every month' || s === 'monthly') return { pattern: 'monthly', interval: 1, dayOfWeek: 1, customUnit: 'days' };
    if (s === 'every year' || s === 'yearly' || s === 'annually') return { pattern: 'yearly', interval: 1, dayOfWeek: 1, customUnit: 'days' };

    const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    for (let i = 0; i < DAY_NAMES.length; i++) {
        if (s === `every ${DAY_NAMES[i]}` || s === DAY_NAMES[i])
            return { pattern: 'weekly', interval: 1, dayOfWeek: i, customUnit: 'weeks' };
    }

    const nd = s.match(/^every\s+(\d+)\s+days?$/);
    if (nd) return { pattern: 'custom', interval: +nd[1], dayOfWeek: 1, customUnit: 'days' };

    const nw = s.match(/^every\s+(\d+)\s+weeks?$/);
    if (nw) return { pattern: 'custom', interval: +nw[1], dayOfWeek: 1, customUnit: 'weeks' };

    const nm = s.match(/^every\s+(\d+)\s+months?$/);
    if (nm) return { pattern: 'custom', interval: +nm[1], dayOfWeek: 1, customUnit: 'months' };

    if (s === 'every week' || s === 'weekly') return { pattern: 'weekly', interval: 1, dayOfWeek: 1, customUnit: 'weeks' };

    return { pattern: 'none', interval: 1, dayOfWeek: 1, customUnit: 'days' };
}

export function buildRecurrenceString(pattern: string, interval: number, dayOfWeek: number, customUnit: string) {
    if (pattern === 'none') return '';
    if (pattern === 'daily') return 'every day';
    if (pattern === 'weekdays') return 'every weekday';
    if (pattern === 'monthly') return 'every month';
    if (pattern === 'yearly') return 'every year';
    if (pattern === 'weekly') {
        const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        return `every ${DAY_NAMES[dayOfWeek]}`;
    }
    if (pattern === 'custom') {
        const unit = interval === 1 ? customUnit.replace(/s$/, '') : customUnit;
        return `every ${interval} ${unit}`;
    }
    return '';
}

interface RecurrenceSelectorProps {
    value: string;
    onChange: (v: string) => void;
}

export function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
    const [open, setOpen] = useState(false);
    const [dropUp, setDropUp] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { pattern, interval, dayOfWeek, customUnit } = parseRecurrenceString(value);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const handleSelectPattern = (pat: string) => {
        if (pat === 'none') {
            onChange('');
        } else if (pat === 'daily') {
            onChange('every day');
        } else if (pat === 'weekdays') {
            onChange('every weekday');
        } else if (pat === 'monthly') {
            onChange('every month');
        } else if (pat === 'yearly') {
            onChange('every year');
        } else if (pat === 'weekly') {
            onChange('every monday');
        } else if (pat === 'custom') {
            onChange('every 1 day');
        }
    };

    const handleWeeklyDayChange = (day: number) => {
        onChange(buildRecurrenceString('weekly', 1, day, 'weeks'));
    };

    const handleCustomIntervalChange = (val: number) => {
        onChange(buildRecurrenceString('custom', val, 1, customUnit));
    };

    const handleCustomUnitChange = (unit: string) => {
        onChange(buildRecurrenceString('custom', interval, 1, unit));
    };

    const patternLabels: Record<string, string> = {
        none: 'None',
        daily: 'Daily',
        weekdays: 'Weekdays',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
        custom: 'Custom'
    };

    const displayLabel = value ? (pattern === 'custom' ? `Every ${interval} ${interval === 1 ? customUnit.replace(/s$/, '') : customUnit}` : patternLabels[pattern] || value) : 'None';

    const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => {
                    if (!open && ref.current) {
                        const rect = ref.current.getBoundingClientRect();
                        setDropUp(window.innerHeight - rect.bottom < 300);
                    }
                    setOpen(o => !o);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-350 dark:border-white/20 text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-white/5 transition-all bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
            >
                <span className="text-xs">↺</span>
                <span>{displayLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            {open && (
                <div className={`absolute ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} right-0 lg:left-0 z-[100] bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-white/20 rounded-xl shadow-xl p-3.5 min-w-[280px] space-y-3 max-h-[300px] overflow-y-auto`}>
                    <div>
                        <label className="block text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Repeat Pattern</label>
                        <SearchableSelect
                            options={[
                                { value: 'none', label: 'None' },
                                { value: 'daily', label: 'Daily' },
                                { value: 'weekdays', label: 'Weekdays' },
                                { value: 'weekly', label: 'Weekly' },
                                { value: 'monthly', label: 'Monthly' },
                                { value: 'yearly', label: 'Yearly' },
                                { value: 'custom', label: 'Custom…' },
                            ]}
                            value={pattern}
                            onChange={(v) => handleSelectPattern(v)}
                            placeholder="Select pattern..."
                        />
                    </div>

                    {pattern === 'weekly' && (
                        <div>
                            <label className="block text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Repeat On</label>
                            <div className="flex gap-1 justify-between">
                                {WEEKDAYS.map((day, idx) => (
                                    <button
                                        key={day}
                                        onClick={() => handleWeeklyDayChange(idx)}
                                        className={`w-7 h-7 text-xs rounded-full flex items-center justify-center font-bold border transition-colors
                                            ${dayOfWeek === idx
                                                ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                                                : 'border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {pattern === 'custom' && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Custom Rule</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-neutral-600 dark:text-neutral-400 font-bold">Every</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={interval}
                                    onChange={e => handleCustomIntervalChange(Math.max(1, +e.target.value))}
                                    className="w-14 text-xs font-bold bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-white/10 rounded-lg px-2 py-1.5 outline-none text-neutral-850 dark:text-neutral-255"
                                />
                                <SearchableSelect
                                    options={[
                                        { value: 'days', label: 'Days' },
                                        { value: 'weeks', label: 'Weeks' },
                                        { value: 'months', label: 'Months' },
                                    ]}
                                    value={customUnit}
                                    onChange={(v) => handleCustomUnitChange(v)}
                                    placeholder="Unit"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
