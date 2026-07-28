"use client";

import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isValid, parseISO } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/components/time-tracker/lib/utils';
import { DateRange } from 'react-day-picker';

export interface DateRangePickerProps {
    from?: string;
    to?: string;
    period?: string;
    onChange: (range: { from: string; to: string; period?: string }) => void;
    triggerClassName?: string;
}

export function DateRangePicker({ from, to, period, onChange, triggerClassName }: DateRangePickerProps) {
    const locale = useLocale();
    const t = useTranslations('Hr.timesheets');
    const [isOpen, setIsOpen] = useState(false);

    const [range, setRange] = useState<DateRange | undefined>(undefined);
    
    // Sync internal state with props when popover opens
    useEffect(() => {
        if (isOpen) {
            setRange({
                from: from && isValid(parseISO(from)) ? parseISO(from) : undefined,
                to: to && isValid(parseISO(to)) ? parseISO(to) : undefined,
            });
        }
    }, [isOpen, from, to]);

    const dateFnsLocale = locale === 'nl' ? nl : locale === 'fr' ? fr : enUS;

    const presets = [
        { label: t('periodThisWeek', { fallback: 'Deze week' }), id: 'thisWeek', getRange: () => {
            const now = new Date();
            return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
        }},
        { label: t('periodLastWeek', { fallback: 'Vorige week' }), id: 'lastWeek', getRange: () => {
            const now = new Date();
            const lw = subDays(now, 7);
            return { from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }) };
        }},
        { label: t('periodThisMonth', { fallback: 'Deze maand' }), id: 'thisMonth', getRange: () => {
            const now = new Date();
            return { from: startOfMonth(now), to: endOfMonth(now) };
        }},
        { label: t('periodLastMonth', { fallback: 'Vorige maand' }), id: 'lastMonth', getRange: () => {
            const now = new Date();
            const lm = subMonths(now, 1);
            return { from: startOfMonth(lm), to: endOfMonth(lm) };
        }},
        { label: t('periodThisQuarter', { fallback: 'Dit kwartaal' }), id: 'thisQuarter', getRange: () => {
            const now = new Date();
            return { from: startOfQuarter(now), to: endOfQuarter(now) };
        }},
        { label: t('periodThisYear', { fallback: 'Dit jaar' }), id: 'thisYear', getRange: () => {
            const now = new Date();
            return { from: startOfYear(now), to: endOfYear(now) };
        }},
        { label: t('periodCustom', { fallback: 'Aangepast' }), id: 'custom', getRange: () => null }
    ];

    const applyPreset = (presetId: string, rangeObj: { from: Date; to: Date } | null) => {
        if (presetId === 'custom') {
            // Just switch to custom mode, don't apply immediately
            setRange(undefined);
            return;
        }
        
        if (rangeObj) {
            onChange({
                from: format(rangeObj.from, 'yyyy-MM-dd'),
                to: format(rangeObj.to, 'yyyy-MM-dd'),
                period: presetId
            });
            setIsOpen(false);
        }
    };

    const handleApplyCustom = () => {
        if (range?.from && range?.to) {
            // Swap if backwards
            let finalFrom = range.from;
            let finalTo = range.to;
            if (finalFrom > finalTo) {
                finalFrom = range.to;
                finalTo = range.from;
            }
            
            onChange({
                from: format(finalFrom, 'yyyy-MM-dd'),
                to: format(finalTo, 'yyyy-MM-dd'),
                period: 'custom'
            });
            setIsOpen(false);
        }
    };

    const getTriggerText = () => {
        if (period && period !== 'custom') {
            const preset = presets.find(p => p.id === period);
            if (preset) return preset.label;
        }
        
        if (from && to) {
            const dFrom = parseISO(from);
            const dTo = parseISO(to);
            if (isValid(dFrom) && isValid(dTo)) {
                return `${format(dFrom, 'd MMM yyyy', { locale: dateFnsLocale })} – ${format(dTo, 'd MMM yyyy', { locale: dateFnsLocale })}`;
            }
        }
        
        return t('period', { fallback: 'Selecteer periode' });
    };

    // Calculate days for footer
    let daysCount = 0;
    if (range?.from && range?.to) {
        const ms = Math.abs(range.to.getTime() - range.from.getTime());
        daysCount = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    className={cn("justify-start text-left font-normal h-9 rounded-xl", triggerClassName)}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {getTriggerText()}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col sm:flex-row">
                    {/* Left Rail */}
                    <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-border min-w-[160px]">
                        {presets.map(p => {
                            const isCustomButActive = p.id === 'custom' && (!period || period === 'custom');
                            const isActive = period === p.id || isCustomButActive;
                            
                            return (
                                <Button
                                    key={p.id}
                                    variant={isActive ? "secondary" : "ghost"}
                                    className="justify-start text-left text-sm h-8"
                                    onClick={() => applyPreset(p.id, p.getRange())}
                                >
                                    {p.label}
                                </Button>
                            );
                        })}
                    </div>
                    
                    {/* Right side Calendar & Footer */}
                    <div className="flex flex-col">
                        <Calendar
                            mode="range"
                            selected={range}
                            onSelect={setRange}
                            numberOfMonths={2}
                            weekStartsOn={1}
                            locale={dateFnsLocale}
                            defaultMonth={range?.from || new Date()}
                            className="p-3"
                        />
                        
                        <div className="flex items-center justify-between p-3 border-t border-border">
                            <div className="text-sm text-muted-foreground">
                                {daysCount > 0 ? t('daysCount', { count: daysCount, fallback: `${daysCount} dagen` }) : ''}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                                    {t('cancel', { fallback: 'Annuleren' })}
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={handleApplyCustom} 
                                    disabled={!range?.from || !range?.to}
                                    className="bg-[var(--brand-color,#d35400)] text-white hover:bg-[var(--brand-color,#d35400)]/90"
                                >
                                    {t('apply', { fallback: 'Toepassen' })}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
