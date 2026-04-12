"use client";

import React, { useMemo, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useDatabaseStore } from '../store';
import { useLocale } from 'next-intl';
import { Property } from '../types';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/time-tracker/components/ui/dropdown-menu';

type SummaryType = 'none' | 'count' | 'sum' | 'average' | 'min' | 'max';

interface DatabaseFooterProps {
    databaseId: string;
    viewId?: string;
    lockedSchema?: boolean;
    hideNewButton?: boolean;
    orderedVisibleProperties: Property[];
    viewStateMap: Map<string, any>;
}

const SUMMARY_LABELS: Record<SummaryType, string> = {
    none: 'None',
    count: 'Count',
    sum: 'Sum',
    average: 'Average',
    min: 'Min',
    max: 'Max',
};

const NEW_LABELS: Record<string, string> = {
    nl: '+ Nieuw',
    fr: '+ Nouveau',
    en: '+ New',
    ro: '+ Nou',
    ru: '+ Новый',
};

export default function DatabaseFooter({
    databaseId,
    viewId,
    lockedSchema,
    hideNewButton,
    orderedVisibleProperties,
    viewStateMap,
}: DatabaseFooterProps) {
    const locale = useLocale();
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const createPage = useDatabaseStore(state => state.createPage);
    const pages = database?.pages || [];

    // Per-column summary type state (default: none, except currency/number default to sum)
    const [summaryTypes, setSummaryTypes] = useState<Record<string, SummaryType>>({});

    const getSummaryType = (prop: Property): SummaryType => {
        if (summaryTypes[prop.id] !== undefined) return summaryTypes[prop.id];
        // Default: currency/number → sum, others → none
        if (prop.type === 'currency' || prop.type === 'number') return 'sum';
        return 'none';
    };

    const setSummaryForProp = (propId: string, type: SummaryType) => {
        setSummaryTypes(prev => ({ ...prev, [propId]: type }));
    };

    // Compute summaries per property
    const summaries = useMemo(() => {
        const result: Record<string, string> = {};

        orderedVisibleProperties.forEach(prop => {
            const type = getSummaryType(prop);
            if (type === 'none') {
                result[prop.id] = '';
                return;
            }

            const values = pages
                .map(p => p.properties[prop.id])
                .filter(v => v !== undefined && v !== null && v !== '');

            if (type === 'count') {
                result[prop.id] = `${values.length}`;
                return;
            }

            // Numeric operations
            const nums = values.map(v => parseFloat(String(v))).filter(n => !isNaN(n));

            if (nums.length === 0) {
                result[prop.id] = '—';
                return;
            }

            switch (type) {
                case 'sum':
                    result[prop.id] = nums.reduce((a, b) => a + b, 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    break;
                case 'average':
                    result[prop.id] = (nums.reduce((a, b) => a + b, 0) / nums.length).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    break;
                case 'min':
                    result[prop.id] = Math.min(...nums).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    break;
                case 'max':
                    result[prop.id] = Math.max(...nums).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    break;
            }
        });

        return result;
    }, [pages, orderedVisibleProperties, summaryTypes]);

    const newLabel = NEW_LABELS[locale] || NEW_LABELS.en;

    // Available summary types depend on column type
    const getSummaryOptions = (prop: Property): SummaryType[] => {
        if (prop.type === 'currency' || prop.type === 'number') {
            return ['none', 'count', 'sum', 'average', 'min', 'max'];
        }
        return ['none', 'count'];
    };

    return (
        <div className="flex-shrink-0 border-t border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-neutral-900/50">
            {/* Summary row */}
            <div className="flex h-8 items-stretch overflow-hidden">
                {/* Spacer for row number + checkbox + grip columns */}
                <div style={{ width: '123px', minWidth: '123px' }} className="flex-shrink-0 border-r border-neutral-200 dark:border-white/10" />

                {/* Summary cells aligned with columns */}
                <div className="flex min-w-max">
                    {orderedVisibleProperties.map(prop => {
                        const state = viewStateMap.get(prop.id);
                        const width = state?.width || 150;
                        const currentType = getSummaryType(prop);
                        const options = getSummaryOptions(prop);
                        const value = summaries[prop.id];

                        return (
                            <DropdownMenu key={prop.id}>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                        className="border-r border-neutral-200 dark:border-white/10 flex items-center px-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/5 transition group"
                                    >
                                        {currentType === 'none' ? (
                                            <span className="text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                Calculate <ChevronDown className="w-2.5 h-2.5" />
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1 w-full">
                                                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">{SUMMARY_LABELS[currentType]}</span>
                                                <span className="text-xs text-neutral-700 dark:text-neutral-300 font-semibold ml-auto tabular-nums">{value}</span>
                                            </div>
                                        )}
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-36 z-[100]">
                                    {options.map(opt => (
                                        <DropdownMenuItem
                                            key={opt}
                                            onClick={() => setSummaryForProp(prop.id, opt)}
                                            className={`cursor-pointer text-xs ${currentType === opt ? 'font-bold text-blue-600' : ''}`}
                                        >
                                            {SUMMARY_LABELS[opt]}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        );
                    })}
                </div>
            </div>

            {/* Add row button */}
            {!hideNewButton && (
                <div className="px-3 py-2 border-t border-neutral-200 dark:border-white/10">
                    <button
                        onClick={() => createPage(databaseId)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg hover:opacity-90 active:opacity-80 transition-all shadow-sm hover:shadow-md"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        <Plus className="w-4 h-4" />
                        <span>{newLabel}</span>
                    </button>
                </div>
            )}

            {/* Count indicator */}
            <div className="px-4 py-1 text-[10px] text-neutral-400 uppercase tracking-wider font-medium border-t border-neutral-100 dark:border-white/5">
                {pages.length} {pages.length === 1 ? 'record' : 'records'}
            </div>
        </div>
    );
}
