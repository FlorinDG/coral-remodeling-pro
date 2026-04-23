"use client";

import React, { useMemo } from 'react';
import { useDatabaseStore } from '../store';
import { Block, Database, Page, PropertyValue } from '../types';
import { Database as DatabaseIcon, Hash, AlertCircle, ChevronRight } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────────
// PropertyMentionBlock — renders a resolved @prop or @this_page mention
//
// Standalone block in the BlockEditor's journal tab. Displays:
//   📊 Database Name → Property Name: Resolved Value
//
// If the mention targets a multi-record DB with an aggregator,
// it resolves the chain: DB → all records → property values → aggregate.
// ────────────────────────────────────────────────────────────────────────────────

interface PropertyMentionBlockProps {
    block: Block;
    currentPageId?: string;
    currentDatabaseId?: string;
}

function resolveValue(
    databases: Database[],
    config: NonNullable<Block['mentionConfig']>,
    currentPageId?: string,
    currentDatabaseId?: string
): { value: PropertyValue; label: string; error?: string } {
    const targetDb = databases.find(d => d.id === config.databaseId);
    if (!targetDb) return { value: null, label: 'DB not found', error: `Database "${config.databaseId}" not found` };

    const prop = targetDb.properties.find(p => p.id === config.propertyId);
    if (!prop) return { value: null, label: 'Property not found', error: `Property not found in ${targetDb.name}` };

    // Case 1: @this_page — resolve from the current page in its own database
    if (config.type === 'this_page') {
        if (!currentDatabaseId || !currentPageId) return { value: null, label: 'No page context' };

        const currentDb = databases.find(d => d.id === currentDatabaseId);
        const page = currentDb?.pages.find(p => p.id === currentPageId);
        if (!page) return { value: null, label: 'Current page not found' };

        const val = page.properties[config.propertyId];
        return { value: val ?? null, label: `${prop.name}` };
    }

    // Case 2: @prop — resolve from target database
    // If the current page has a relation to the target DB, use it as filter
    let pages: Page[] = targetDb.pages;

    // Try to auto-filter: check if current page has a relation pointing to targetDb
    if (currentDatabaseId && currentPageId) {
        const currentDb = databases.find(d => d.id === currentDatabaseId);
        const currentPage = currentDb?.pages.find(p => p.id === currentPageId);

        if (currentPage && currentDb) {
            // Find relation properties in current DB that point to target DB
            const relationProp = currentDb.properties.find(
                p => p.type === 'relation' && p.config?.relationDatabaseId === config.databaseId
            );

            if (relationProp) {
                const relatedIds = currentPage.properties[relationProp.id];
                if (Array.isArray(relatedIds) && relatedIds.length > 0) {
                    pages = targetDb.pages.filter(p => relatedIds.includes(p.id));
                }
            }
        }
    }

    // Explicit filter
    if (config.filter) {
        const filterProp = targetDb.properties.find(p => p.id === config.filter!.propertyId);
        if (filterProp && config.filter.value) {
            pages = pages.filter(p => String(p.properties[config.filter!.propertyId]) === config.filter!.value);
        }
    }

    // Extract all values of the target property from filtered pages
    const values = pages.map(p => p.properties[config.propertyId]).filter(v => v !== null && v !== undefined);

    // Apply aggregator
    const agg = config.aggregator || 'first';

    switch (agg) {
        case 'first':
            return { value: values[0] ?? null, label: `${targetDb.name}.${prop.name}` };
        case 'last':
            return { value: values[values.length - 1] ?? null, label: `${targetDb.name}.${prop.name}` };
        case 'count':
            return { value: values.length, label: `${targetDb.name}.${prop.name} (count)` };
        case 'sum': {
            const total = values.reduce<number>((s, v) => s + (Number(v) || 0), 0);
            return { value: Math.round(total * 100) / 100, label: `${targetDb.name}.${prop.name} (sum)` };
        }
        case 'avg': {
            const numVals = values.map(Number).filter(n => !isNaN(n));
            const avg = numVals.length ? numVals.reduce((a, b) => a + b, 0) / numVals.length : 0;
            return { value: Math.round(avg * 100) / 100, label: `${targetDb.name}.${prop.name} (avg)` };
        }
        case 'list':
            return { value: values.map(String).join(', '), label: `${targetDb.name}.${prop.name} (all)` };
        default:
            return { value: values[0] ?? null, label: `${targetDb.name}.${prop.name}` };
    }
}

export default function PropertyMentionBlock({ block, currentPageId, currentDatabaseId }: PropertyMentionBlockProps) {
    const databases = useDatabaseStore(state => state.databases);
    const config = block.mentionConfig;

    const resolved = useMemo(() => {
        if (!config) return { value: null, label: 'No config', error: 'Mention configuration missing' };
        return resolveValue(databases, config, currentPageId, currentDatabaseId);
    }, [databases, config, currentPageId, currentDatabaseId]);

    if (!config) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Invalid mention block
            </div>
        );
    }

    if (resolved.error) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {resolved.error}
            </div>
        );
    }

    const displayValue = resolved.value === null || resolved.value === undefined
        ? '—'
        : typeof resolved.value === 'boolean'
            ? resolved.value ? '✓' : '✗'
            : String(resolved.value);

    const isNumeric = typeof resolved.value === 'number';

    return (
        <div className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors cursor-default select-none">
            {/* Icon */}
            <div
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                style={{
                    backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 12%, transparent)',
                    color: 'var(--brand-color, #d35400)',
                }}
            >
                {isNumeric ? <Hash className="w-3 h-3" /> : <DatabaseIcon className="w-3 h-3" />}
            </div>

            {/* Label chain */}
            <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                {resolved.label.split('.').map((part, i, arr) => (
                    <React.Fragment key={i}>
                        <span>{part}</span>
                        {i < arr.length - 1 && <ChevronRight className="w-2.5 h-2.5 opacity-50" />}
                    </React.Fragment>
                ))}
            </span>

            {/* Value */}
            <span className={`text-sm font-medium ml-auto ${
                isNumeric
                    ? 'font-mono tabular-nums text-neutral-900 dark:text-white'
                    : 'text-neutral-700 dark:text-neutral-300'
            }`}>
                {displayValue}
            </span>
        </div>
    );
}

// ── Inline chip version (for embedding within text blocks) ───────────────────
export function InlinePropertyMention({ block, currentPageId, currentDatabaseId }: PropertyMentionBlockProps) {
    const databases = useDatabaseStore(state => state.databases);
    const config = block.mentionConfig;

    const resolved = useMemo(() => {
        if (!config) return { value: null, label: 'No config', error: 'Missing' };
        return resolveValue(databases, config, currentPageId, currentDatabaseId);
    }, [databases, config, currentPageId, currentDatabaseId]);

    const displayValue = resolved.value === null || resolved.value === undefined
        ? '—'
        : typeof resolved.value === 'boolean'
            ? resolved.value ? '✓' : '✗'
            : String(resolved.value);

    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium border cursor-default"
            style={{
                backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 8%, transparent)',
                borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 20%, transparent)',
                color: 'var(--brand-color, #d35400)',
            }}
            title={`${config?.type === 'this_page' ? '@this_page' : '@prop'}(${resolved.label})`}
        >
            <DatabaseIcon className="w-2.5 h-2.5 opacity-70" />
            {resolved.label.split('.').pop()}:
            <span className="font-semibold text-neutral-900 dark:text-white">{displayValue}</span>
        </span>
    );
}
