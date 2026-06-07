/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import type { Database, DatabaseView, Page } from '../types';

interface UseFilteredPagesParams {
    database: Database | undefined;
    activeView: DatabaseView | undefined;
    hardFilter?: { propertyId: string; value: string };
    allDatabases: Database[];
}

/**
 * Filters database pages based on active filters (view-level or database-level).
 *
 * Resolves display values for all property types so filters match what the user
 * sees in the grid: select option names instead of IDs, relation page titles
 * instead of page IDs, checkbox true/false, etc.
 */
export function useFilteredPages({ database, activeView, hardFilter, allDatabases }: UseFilteredPagesParams): Page[] {
    return useMemo(() => {
        if (!database) return [];
        const activeFilters = activeView?.filters || database.activeFilters || [];

        // Build lookup helpers once per filter pass
        const propMap = new Map(database.properties.map(p => [p.id, p]));

        // Resolve a raw cell value to its display string for filter comparison.
        // This mirrors what the user sees in the grid cell.
        const resolveDisplayValue = (propertyId: string, raw: any): string => {
            const prop = propMap.get(propertyId);
            if (raw === null || raw === undefined) return '';

            if (prop?.type === 'select') {
                // raw is an option ID like "opt-abc" → resolve to display name
                const opt = prop.config?.options?.find(o => o.id === raw);
                return opt?.name ?? String(raw);
            }
            if (prop?.type === 'multi_select') {
                // raw is an array of option IDs
                if (Array.isArray(raw)) {
                    return raw.map(v => {
                        const opt = prop.config?.options?.find(o => o.id === v);
                        return opt?.name ?? String(v);
                    }).join(', ');
                }
                const opt = prop.config?.options?.find(o => o.id === raw);
                return opt?.name ?? String(raw);
            }
            if (prop?.type === 'relation') {
                // raw is an array of page IDs → resolve to their titles
                if (Array.isArray(raw)) {
                    return raw.map(pageId => {
                        // Search all databases for the referenced page
                        for (const db of (allDatabases || [])) {
                            const p = db.pages.find(pg => pg.id === pageId);
                            if (p) return String(p.properties.title ?? pageId);
                        }
                        return String(pageId);
                    }).join(', ');
                }
                return String(raw);
            }
            if (prop?.type === 'checkbox') {
                return raw ? 'true' : 'false';
            }
            if (prop?.type === 'number' || prop?.type === 'currency' || prop?.type === 'percent') {
                return String(raw);
            }
            return String(raw);
        };

        // Check emptiness accounting for arrays
        const isEmpty = (raw: any): boolean => {
            if (raw === null || raw === undefined || raw === '') return true;
            if (Array.isArray(raw)) return raw.length === 0;
            return false;
        };

        return database.pages.filter(page => {
            // Apply immutable hard filter first (e.g. docType partitioning)
            if (hardFilter) {
                const cellVal = page.properties[hardFilter.propertyId];
                const resolvedVal = cellVal ? String(cellVal) : 'opt-invoice'; // Backwards compat: existing records without docType are invoices
                if (resolvedVal !== hardFilter.value) return false;
            }

            if (!activeFilters || activeFilters.length === 0) return true;

            const configuredFilters = activeFilters.filter(filter => {
                const isTextOp = ['equals', 'does_not_equal', 'contains', 'does_not_contain'].includes(filter.operator);
                if (isTextOp && (filter.value === '' || filter.value === undefined || filter.value === null)) {
                    return false;
                }
                return true;
            });

            if (configuredFilters.length === 0) return true;

            const evaluateRule = (filter: typeof activeFilters[0]) => {
                const rawValue = page.properties[filter.propertyId];
                const prop = propMap.get(filter.propertyId);

                // For select equals/does_not_equal, the filter value stores the
                // option ID directly (set by the dropdown in FilterToolbar).
                // Compare against the raw stored value, not the display name.
                if ((prop?.type === 'select' || prop?.type === 'multi_select') &&
                    (filter.operator === 'equals' || filter.operator === 'does_not_equal')) {
                    if (prop.type === 'multi_select' && Array.isArray(rawValue)) {
                        const hasMatch = rawValue.includes(filter.value);
                        return filter.operator === 'equals' ? hasMatch : !hasMatch;
                    }
                    const match = String(rawValue) === String(filter.value);
                    return filter.operator === 'equals' ? match : !match;
                }
                // For checkbox, compare boolean raw value against the string
                // "true"/"false" sent by the FilterToolbar dropdown.
                if (prop?.type === 'checkbox' &&
                    (filter.operator === 'equals' || filter.operator === 'does_not_equal')) {
                    const boolFilter = String(filter.value) === 'true';
                    const boolRaw = !!rawValue;
                    const match = boolRaw === boolFilter;
                    return filter.operator === 'equals' ? match : !match;
                }

                // For text-based operators, resolve to display value so user can
                // type "Active" instead of "opt-abc123"
                const displayValue = resolveDisplayValue(filter.propertyId, rawValue);

                switch (filter.operator) {
                    case 'equals': return displayValue === String(filter.value);
                    case 'does_not_equal': return displayValue !== String(filter.value);
                    case 'contains': return displayValue.toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'does_not_contain': return !displayValue.toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'is_empty': return isEmpty(rawValue);
                    case 'is_not_empty': return !isEmpty(rawValue);
                    default: return true;
                }
            };

            let result = evaluateRule(configuredFilters[0]);

            for (let i = 1; i < configuredFilters.length; i++) {
                const rule = configuredFilters[i];
                const ruleResult = evaluateRule(rule);
                if (rule.conjunction === 'or') {
                    result = result || ruleResult;
                } else {
                    result = result && ruleResult;
                }
            }

            return result;
        });
    }, [database?.pages, database?.properties, activeView?.filters, database?.activeFilters, hardFilter, allDatabases]);
}
