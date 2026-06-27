"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDatabaseStore } from './store';
import {
    DataSheetGrid
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import './NotionGrid.css';
import { useRouter } from 'next/navigation';
import { Download, Upload, Search, Building2, MapPin, CheckCircle2, X, Loader2, Plus, Lock, Trash } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useSession } from 'next-auth/react';
import ColumnHeader from './components/ColumnHeader';
import FilterToolbar from './components/FilterToolbar';
import SortToolbar from './components/SortToolbar';
import { Checkbox } from '@/components/common/Checkbox';
import PageModal from './components/PageModal';
import PropertiesDropdown from './components/PropertiesDropdown';
import { SpreadsheetImportModal } from './components/SpreadsheetImportModal';
import DatabaseFooter from './components/DatabaseFooter';
import AddColumnFlyout from './components/AddColumnFlyout';
import { Property, Page } from './types';
import { toast } from 'sonner';
import { isSystemDatabase } from '@/lib/systemDatabases';
import { useGridColumns } from './hooks/useGridColumns';

import { useVatLookup } from './hooks/useVatLookup';
import { useExportCSV } from './hooks/useExportCSV';

// ── Add Column Button (rendered at the end of the header row) ───────────────
function AddColumnButton({ databaseId }: { databaseId: string }) {
    const t = useTranslations('Admin');
    const [isOpen, setIsOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const addProperty = useDatabaseStore(state => state.addProperty);

    return (
        <div
            className="flex-shrink-0 flex items-center justify-center border-r border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-[#f9fafb] dark:bg-neutral-900 z-20"
            style={{ width: '40px', minWidth: '40px' }}
        >
            <button
                ref={btnRef}
                onClick={() => setIsOpen(!isOpen)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                title={t('placeholders.addColumn')}
            >
                <Plus className="w-4 h-4" />
            </button>
            <AddColumnFlyout
                anchorRef={btnRef}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onAdd={(type) => {
                    addProperty(databaseId, 'Untitled', type);
                }}
            />
        </div>
    );
}

interface NotionGridProps {
    databaseId: string;
    viewId?: string;
    renderTabs?: React.ReactNode;
    lockedSchema?: boolean;
    /** true = block all deletes; function = per-row check (return true to block) */
    preventDelete?: boolean | ((rowData: any) => boolean);
    hideFooterNew?: boolean;
    hardFilter?: { propertyId: string; value: string };
    onOpenRecord?: (pageId: string) => void;
}

export default function NotionGrid({ databaseId, viewId, renderTabs, lockedSchema, preventDelete, hideFooterNew, hardFilter, onOpenRecord }: NotionGridProps) {
    const router = useRouter();
    const t = useTranslations('Admin');
    const { data: session } = useSession();
    const isAccountant = session?.user?.role === 'ACCOUNTANT';
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);
    const deletePage = useDatabaseStore(state => state.deletePage);
    const deletePages = useDatabaseStore(state => state.deletePages);
    const updateViewPropertyOrder = useDatabaseStore(state => state.updateViewPropertyOrder);
    const updatePageOrder = useDatabaseStore(state => state.updatePageOrder);
    const clearDatabase = useDatabaseStore(state => state.clearDatabase);
    const clearFilters = useDatabaseStore(state => state.clearFilters);
    const undo = useDatabaseStore(state => state.undo);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [resizingProperty, setResizingProperty] = useState<string | null>(null);
    const [resizeOffset, setResizeOffset] = useState<number>(0);
    // Track last-committed resize widths per property so the columns memo can
    // immediately use them when resizingProperty transitions to null, before
    // the store→selector→viewStateMap chain catches up in the same React batch.
    const committedWidthsRef = useRef<Map<string, number>>(new Map());
    const [gridKeySuffix, setGridKeySuffix] = useState(0);

    // ── Accountant date range filter ───────────────────────────────────
    const [acctDatePreset, setAcctDatePreset] = useState<string>('this-year');
    const [acctDateFrom, setAcctDateFrom] = useState<string>('');
    const [acctDateTo, setAcctDateTo] = useState<string>('');


    // VAT lookup state is managed by the useVatLookup hook (called after rowData is computed)

    // Column drag-and-drop state (Notion-style)
    const [colDragIndex, setColDragIndex] = useState<number | null>(null);
    const [colDropTarget, setColDropTarget] = useState<number | null>(null);
    const colDropTargetRef = useRef<number | null>(null);
    const colDragCleanup = useRef<(() => void) | null>(null);

    // Subscribe to store changes manually for this specific DB to avoid full-app re-renders
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    // All databases needed for relation filter resolution (looking up page titles)
    const allDatabases = useDatabaseStore(state => state.databases);
    const activeViewId = viewId || database?.views?.[0]?.id; // prioritize explicitly passed viewId from tab engine
    const activeView = database?.views?.find(v => v.id === activeViewId);

    const { activeModules, planType, isPro, isEnterprise } = useTenant();
    const hasCRM = activeModules.includes('CRM');
    const isFree = planType === 'FREE';
    const isBestek = databaseId === 'db-bestek' || databaseId.startsWith('db-bestek-');
    const isBestekReadOnly = isBestek && !isEnterprise;

    const [isReady, setIsReady] = useState(false);
    const [hasHydrated, setHasHydrated] = useState(false);
    const isMounted = useRef(false);
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const footerScrollRef = useRef<HTMLDivElement>(null);
    const gridWrapperRef = useRef<HTMLDivElement>(null);
    const gridAreaRef = useRef<HTMLDivElement>(null);
    const [gridHeight, setGridHeight] = useState(400);

    // Removed vanilla scroll observer interval loop - migrated natively to React capture phases.
    useEffect(() => {
        isMounted.current = true;
        // Delay mounting the grid slightly to ensure the parent flex-box layout 
        // has fully stabilized its pixel dimensions across all sidebars/paddings.
        const timer = setTimeout(() => setIsReady(true), 50);

        useDatabaseStore.persist.onFinishHydration(() => setHasHydrated(true));
        setHasHydrated(useDatabaseStore.persist.hasHydrated());

        return () => {
            isMounted.current = false;
            clearTimeout(timer);
        };
    }, []);

    // Reset header, footer, and grid body scroll when activeViewId changes
    useEffect(() => {
        if (headerScrollRef.current) {
            headerScrollRef.current.style.transform = 'translateX(0px)';
        }
        if (footerScrollRef.current) {
            footerScrollRef.current.style.transform = 'translateX(0px)';
        }
        const gridContainer = gridWrapperRef.current?.querySelector('.dsg-container');
        if (gridContainer) {
            gridContainer.scrollLeft = 0;
        }
    }, [activeViewId]);

    // ── Global Ctrl+Z / ⌘+Z undo handler ────────────────────────────────
    const handleUndo = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            // Don't hijack undo when user is typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            const isEditable = (e.target as HTMLElement)?.isContentEditable;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;

            e.preventDefault();
            const entry = undo();
            if (entry) {
                const labels: Record<string, string> = {
                    updatePageProperty: 'Celwijziging ongedaan gemaakt',
                    deletePage: 'Rij hersteld',
                    deletePages: 'Rijen hersteld',
                    clearDatabase: 'Database hersteld',
                };
                toast.success(labels[entry.type] || 'Ongedaan gemaakt', { duration: 2500 });
            }
        }
    }, [undo]);

    useEffect(() => {
        document.addEventListener('keydown', handleUndo);
        return () => document.removeEventListener('keydown', handleUndo);
    }, [handleUndo]);

    // Measure the grid area and pass pixel height to DataSheetGrid so it fills
    // the container instead of sizing to content (~400 px default).
    useEffect(() => {
        // Observe the outer flex-1 wrapper — it fills all remaining viewport height.
        // gridAreaRef (inner) starts at DataSheetGrid's own default height, creating
        // a circular measurement trap. Watching the wrapper avoids this.
        const el = gridWrapperRef.current;
        if (!el) return;
        const HEADER_OFFSET = 36; // height of the floating column-header row (pt-9 = 36px)
        const ro = new ResizeObserver((entries) => {
            const h = entries[0]?.contentRect.height;
            if (h > 0) setGridHeight(h - HEADER_OFFSET);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const databaseIdRef = database?.id || '';



    const viewStateMap = useMemo(() => {
        return new Map(activeView?.propertiesState?.map(ps => [ps.propertyId, ps]) || []);
    }, [activeView?.propertiesState]);

    // Once the store has propagated the new widths into viewStateMap,
    // clear the committed-width overrides so we don't hold stale values.
    useEffect(() => {
        if (committedWidthsRef.current.size === 0) return;
        committedWidthsRef.current.forEach((width, propId) => {
            const storeWidth = viewStateMap.get(propId)?.width;
            if (storeWidth === width) {
                committedWidthsRef.current.delete(propId);
            }
        });
    }, [viewStateMap]);

    const orderedVisibleProperties = useMemo(() => {
        const props = database?.properties || [];
        
        // ENFORCE LICENSING ISOLATION: Hide 'Lead Source' property for Free Tier
        let filteredProps = [...props];
        if (!hasCRM && databaseId === 'db-clients') {
            filteredProps = filteredProps.filter(p => p.name.toLowerCase() !== 'lead source');
        }

        return filteredProps
            .filter(prop => {
                const state = viewStateMap.get(prop.id);
                return !state?.hidden;
            })
            .sort((a, b) => {
                const orderA = viewStateMap.get(a.id)?.order ?? 999;
                const orderB = viewStateMap.get(b.id)?.order ?? 999;
                return orderA - orderB;
            });
    }, [database, viewStateMap, databaseId, hasCRM]);

    const handleOpenPage = useCallback((action: React.SetStateAction<string | null>) => {
        const id = typeof action === 'function' ? action(activePageId) : action;
        if (id && onOpenRecord) {
            onOpenRecord(id);
        } else {
            setActivePageId(action);
        }
    }, [onOpenRecord, activePageId]);

    const columns = useGridColumns({
        databaseId,
        databaseIdRef,
        activeViewId,
        orderedVisibleProperties,
        viewStateMap,
        resizingProperty,
        resizeOffset,
        committedWidthsRef,
        isBestekReadOnly,
        isFree,
        preventDelete,
        router,
        updatePageProperty,
        updatePageOrder,
        createPage,
        deletePage,
        setSelectedRowIds,
        setActivePageId: handleOpenPage,
    });
    const activeFilters = useMemo(() => {
        if (!database) return [];
        return activeView?.filters || database.activeFilters || [];
    }, [database, activeView?.filters, database?.activeFilters]);

    const filteredPages = useMemo(() => {
        if (!database) return [];

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

            // Always include newly created pages to prevent them from being hidden by active filters while editing (GRID-3)
            // eslint-disable-next-line react-hooks/purity
            const isRecent = Date.now() - new Date(page.createdAt).getTime() < 120000;
            if (isRecent) return true;

            if (!activeFilters || activeFilters.length === 0) return true;

            const configuredFilters = activeFilters.filter(filter => {
                if (!propMap.has(filter.propertyId)) {
                    return false;
                }
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
    }, [database, activeView?.filters, hardFilter, allDatabases]);

    // Execute Client-Side Sorting
    const sortedPages = useMemo(() => {
        if (!database) return [];
        const activeSorts = activeView?.sorts || database.activeSorts || [];

        // Partition: newly created pages are forced to the top
        const newPages: Page[] = [];
        const regularPages: Page[] = [];

        filteredPages.forEach(p => {
            // eslint-disable-next-line react-hooks/purity
            const isRecent = Date.now() - new Date(p.createdAt).getTime() < 120000;
            if (isRecent) {
                newPages.push(p);
            } else {
                regularPages.push(p);
            }
        });

        // Use Intl.Collator with numeric: true for natural sorting (e.g., "10" > "2")
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

        const sortedRegular = [...regularPages].sort((a, b) => {
            if (!activeSorts || activeSorts.length === 0) {
                // Default: Newest on top
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }

            for (const sort of activeSorts) {
                const valA = a.properties[sort.propertyId];
                const valB = b.properties[sort.propertyId];

                if (valA === valB) continue;

                const isAsc = sort.direction === 'ascending';

                // Handle nulls/empties consistently
                if (valA === undefined || valA === null || valA === '') return isAsc ? 1 : -1;
                if (valB === undefined || valB === null || valB === '') return isAsc ? -1 : 1;

                const strA = String(valA || '').trim();
                const strB = String(valB || '').trim();

                // 1. Numerical parse attempt (only for pure numbers)
                const cleanA = strA.replace(',', '.');
                const cleanB = strB.replace(',', '.');
                const valNumA = Number(cleanA);
                const valNumB = Number(cleanB);
                const isNumA = cleanA !== '' && !isNaN(valNumA) && isFinite(valNumA);
                const isNumB = cleanB !== '' && !isNaN(valNumB) && isFinite(valNumB);

                let result = 0;
                if (isNumA && isNumB) {
                    result = valNumA - valNumB;
                } else {
                    result = collator.compare(strA, strB);
                }

                if (result !== 0) {
                    return isAsc ? result : -result;
                }
            }

            return 0;
        });

        // Combine new pages at the very top (sorted newest first) followed by sorted regular pages
        newPages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return [...newPages, ...sortedRegular];
    }, [database, filteredPages, activeView?.sorts]);

    // ── Accountant date range filtering (applied after sort) ──────────────
    const acctDateFilteredPages = useMemo(() => {
        if (!isAccountant) return sortedPages;

        // Resolve preset to from/to dates
        const now = new Date();
        let from = acctDateFrom;
        let to = acctDateTo;

        if (acctDatePreset !== 'custom') {
            const y = now.getFullYear();
            const m = now.getMonth();
            switch (acctDatePreset) {
                case 'last-month': {
                    const d = new Date(y, m - 1, 1);
                    from = d.toISOString().split('T')[0];
                    to = new Date(y, m, 0).toISOString().split('T')[0];
                    break;
                }
                case 'last-trimester': {
                    const qStart = Math.floor(m / 3) * 3;
                    from = new Date(y, qStart - 3, 1).toISOString().split('T')[0];
                    to = new Date(y, qStart, 0).toISOString().split('T')[0];
                    break;
                }
                case 'last-semester': {
                    if (m < 6) {
                        from = `${y - 1}-07-01`;
                        to = `${y - 1}-12-31`;
                    } else {
                        from = `${y}-01-01`;
                        to = `${y}-06-30`;
                    }
                    break;
                }
                case 'this-year':
                    from = `${y}-01-01`;
                    to = now.toISOString().split('T')[0];
                    break;
                case 'last-year':
                    from = `${y - 1}-01-01`;
                    to = `${y - 1}-12-31`;
                    break;
                case 'last-calendar-year':
                    from = `${y - 1}-01-01`;
                    to = `${y - 1}-12-31`;
                    break;
                default:
                    return sortedPages;
            }
        }

        if (!from && !to) return sortedPages;

        // Find the date property to filter on
        const dateField = database?.properties.find(p =>
            p.id === 'invoiceDate' || p.id === 'date'
        )?.id || 'invoiceDate';

        return sortedPages.filter(page => {
            const dateVal = page.properties[dateField];
            if (!dateVal) return false;
            const d = String(dateVal).split('T')[0];
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }, [sortedPages, isAccountant, acctDatePreset, acctDateFrom, acctDateTo, database?.properties]);

    // Convert sorted filtered pages to row data by flattening properties to the top level for data-sheet-grid access
    // Memoizing this to prevent infinite re-renders or synchronous onChange triggers from DataSheetGrid
    const rowData = useMemo(() => acctDateFilteredPages.map(page => ({
        ...page,
        ...page.properties,
        _isSelected: selectedRowIds.has(page.id),
        // Force DSG cell re-render when property values change by including a lightweight hash
        _propHash: JSON.stringify(page.properties)
    })), [acctDateFilteredPages, selectedRowIds]);

    // ── Live VAT lookup flyout logic (encapsulated in useVatLookup hook) ─────
    const { vatLookup, setVatLookup, applyVatLookup } = useVatLookup({
        database,
        rowData,
        gridAreaRef,
        updatePageProperty,
    });




    const handleExportCSV = useExportCSV({
        database,
        filteredPages: acctDateFilteredPages,
        isAccountant,
        updatePageProperty,
    });

    const handleAccountantExport = () => {
        const now = new Date();
        let from = acctDateFrom;
        let to = acctDateTo;
        const y = now.getFullYear();
        const m = now.getMonth();

        if (acctDatePreset !== 'custom') {
            switch (acctDatePreset) {
                case 'last-month': {
                    const d = new Date(y, m - 1, 1);
                    from = d.toISOString().split('T')[0];
                    to = new Date(y, m, 0).toISOString().split('T')[0];
                    break;
                }
                case 'last-trimester': {
                    const qStart = Math.floor(m / 3) * 3;
                    from = new Date(y, qStart - 3, 1).toISOString().split('T')[0];
                    to = new Date(y, qStart, 0).toISOString().split('T')[0];
                    break;
                }
                case 'last-semester': {
                    if (m < 6) {
                        from = `${y - 1}-07-01`;
                        to = `${y - 1}-12-31`;
                    } else {
                        from = `${y}-01-01`;
                        to = `${y}-06-30`;
                    }
                    break;
                }
                case 'this-year':
                    from = `${y}-01-01`;
                    to = now.toISOString().split('T')[0];
                    break;
                case 'last-year':
                case 'last-calendar-year':
                    from = `${y - 1}-01-01`;
                    to = `${y - 1}-12-31`;
                    break;
            }
        }

        if (!from && !to) {
            toast.error('Selecteer een periode');
            return;
        }

        const url = new URL('/api/financials/export', window.location.origin);
        if (from) url.searchParams.set('startDate', from);
        if (to) url.searchParams.set('endDate', to);
        
        window.location.href = url.toString();
    };

    // processImportedData and handleImportFile stripped in favor of the unified <SpreadsheetImportModal>

    if (!database || !hasHydrated) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl shadow-sm relative">
            <div className="px-3 pt-2.5 pb-0 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end justify-between relative z-[60] flex-wrap gap-2">
                <div className="flex items-end pr-2 shrink-0">
                    {renderTabs ? renderTabs : (
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 pb-2">
                            {database.icon && <span>{database.icon}</span>}
                            {database.name}
                            <span className="text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full ml-2">
                                {filteredPages.length} Rows
                            </span>
                        </h2>
                    )}
                </div>
                <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar">
                    {activeViewId && <PropertiesDropdown databaseId={database.id} viewId={activeViewId} />}
                    <FilterToolbar databaseId={database.id} viewId={activeViewId} />
                    <SortToolbar databaseId={database.id} viewId={activeViewId} />

                    {!isAccountant && (
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Export</span>
                    </button>
                    )}

                    {/* Accountant: date range filter + export */}
                    {isAccountant && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Period preset */}
                        <div className="relative min-w-[160px]">
                            <SearchableSelect
                                options={[
                                    { value: 'this-year', label: 'This Year' },
                                    { value: 'last-month', label: 'Last Month' },
                                    { value: 'last-trimester', label: 'Last Trimester' },
                                    { value: 'last-semester', label: 'Last Semester' },
                                    { value: 'last-calendar-year', label: 'Last Calendar Year' },
                                    { value: 'last-year', label: 'Last Year' },
                                    { value: 'custom', label: 'Custom Range' },
                                ]}
                                value={acctDatePreset}
                                onChange={(v) => {
                                    setAcctDatePreset(v);
                                    if (v !== 'custom') {
                                        setAcctDateFrom('');
                                        setAcctDateTo('');
                                    }
                                }}
                                placeholder={t('placeholders.period')}
                            />
                        </div>

                        {/* Custom date inputs */}
                        {acctDatePreset === 'custom' && (
                            <>
                                <input
                                    type="date"
                                    value={acctDateFrom}
                                    onChange={e => setAcctDateFrom(e.target.value)}
                                    className="text-xs px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    placeholder={t('placeholders.from')}
                                />
                                <span className="text-xs text-neutral-400">&rarr;</span>
                                <input
                                    type="date"
                                    value={acctDateTo}
                                    onChange={e => setAcctDateTo(e.target.value)}
                                    className="text-xs px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    placeholder={t('placeholders.to')}
                                />
                            </>
                        )}

                        {/* Result count */}
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                            {acctDateFilteredPages.length} records
                        </span>

                        {/* Export button */}
                        <button
                            onClick={handleAccountantExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                        >
                            📦 Boekhouder export
                        </button>
                    </div>
                    )}

                    {!lockedSchema && !isAccountant && !isBestekReadOnly && (
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Import</span>
                    </button>
                    )}

                    {/* Bulk delete — only show if not blanket-blocked.
                        For callback-based preventDelete, filter out non-deletable rows before executing. */}
                    {preventDelete !== true && !isAccountant && !isBestekReadOnly && (
                    <button
                        onClick={() => {
                            if (selectedRowIds.size > 0) {
                                // If preventDelete is a per-row callback, filter to only deletable rows
                                let idsToDelete = Array.from(selectedRowIds);
                                if (typeof preventDelete === 'function') {
                                    idsToDelete = idsToDelete.filter(rid => {
                                        const row = rowData.find(r => r.id === rid);
                                        return row && !preventDelete(row);
                                    });
                                    if (idsToDelete.length === 0) {
                                        alert('None of the selected records can be deleted (only draft records are deletable).');
                                        return;
                                    }
                                }
                                if (window.confirm(`Are you sure you want to permanently delete ${idsToDelete.length} selected rows?`)) {
                                    deletePages(database.id, idsToDelete);
                                    setSelectedRowIds(new Set());
                                }
                            } else if (!preventDelete) {
                                // Only allow "clear all" if no per-row guard at all
                                if (window.confirm("Are you sure you want to permanently delete ALL records in this database?")) {
                                    clearDatabase(database.id);
                                }
                            }
                        }}
                        className="flex items-center justify-center p-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition"
                        title={selectedRowIds.size > 0 ? `Delete ${selectedRowIds.size} Selected Rows` : "Clear All Rows"}
                    >
                        <Trash className="w-3.5 h-3.5" />
                        {selectedRowIds.size > 0 && <span className="font-semibold ml-1 leading-none">{selectedRowIds.size}</span>}
                    </button>
                    )}
                </div>
            </div>

            {/* ── Export lock banner (non-accountant users) ────────────────────── */}
            {!isAccountant && (() => {
                const exportedCount = acctDateFilteredPages.filter(p => p.properties.accountantExportedAt).length;
                if (exportedCount === 0) return null;
                return (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            <strong>{exportedCount} record{exportedCount > 1 ? 's' : ''}</strong> sent to accountant &mdash; editing locked.
                        </p>
                    </div>
                );
            })()}

            {/* ── Filter safety banner ── */}
            {filteredPages.length === 0 && database.pages.length > 0 && activeFilters.length > 0 && (
                <div className="px-4 py-2 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-500/20 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                        Filters active ({activeFilters.length}) &mdash; No rows match current filters.
                    </p>
                    <button
                        onClick={() => clearFilters(database.id, activeViewId)}
                        className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline transition-colors shrink-0"
                    >
                        Clear
                    </button>
                </div>
            )}

            <div
                className="flex-1 w-full p-0 relative overflow-hidden min-h-0 bg-white dark:bg-black"
                ref={gridWrapperRef}
                onScrollCapture={(e) => {
                    // Synchronously intercept bubbled scroll events and lock the header offset translation
                    const target = e.target as HTMLElement;
                    if (target.classList?.contains('dsg-container') && headerScrollRef.current) {
                        headerScrollRef.current.style.transform = `translateX(-${target.scrollLeft}px)`;
                    }
                    if (target.classList?.contains('dsg-container') && footerScrollRef.current) {
                        footerScrollRef.current.style.transform = `translateX(-${target.scrollLeft}px)`;
                    }
                }}
                onDragOver={(e) => {
                    // Automatically scroll the inner grid body if dragging near horizontal boundary edges
                    const gridContainer = gridWrapperRef.current?.querySelector('.dsg-container');
                    if (gridContainer) {
                        const rect = gridContainer.getBoundingClientRect();
                        const relativeX = e.clientX - rect.left;
                        if (relativeX < 60) gridContainer.scrollLeft -= 15; // Pan left aggressively
                        if (relativeX > rect.width - 60) gridContainer.scrollLeft += 15; // Pan right aggressively
                    }
                }}
            >
                {isReady ? (
                    <div 
                        className={`w-full h-full flex flex-col pt-9 relative ${activePageId ? 'pointer-events-none' : ''}`}
                        inert={activePageId ? true : undefined}
                    >
                        {/* Custom Floating Header context to override native grid pointer events */}
                        <div
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onWheel={e => {
                                const gridContainer = gridWrapperRef.current?.querySelector('.dsg-container') as HTMLElement | null;
                                if (gridContainer && Math.abs(e.deltaX) > 0) {
                                    const canScrollLeft = gridContainer.scrollLeft > 0;
                                    const canScrollRight = gridContainer.scrollLeft < (gridContainer.scrollWidth - gridContainer.clientWidth - 1);
                                    const isScrollingLeft = e.deltaX < 0;
                                    const isScrollingRight = e.deltaX > 0;
                                    
                                    if ((isScrollingLeft && canScrollLeft) || (isScrollingRight && canScrollRight)) {
                                        gridContainer.scrollLeft += e.deltaX;
                                        if (e.cancelable) {
                                            e.preventDefault();
                                        }
                                    }
                                }
                            }}
                            className="absolute top-0 left-0 right-0 h-9 z-50 flex bg-[#f9fafb] dark:bg-neutral-900 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 overflow-visible pointer-events-auto"
                        >
                            {/* React DataSheet Grid Row Number Gutter Spacer + Selection Spacer + Grip Spacer */}
                            <div
                                style={{ width: '123px', minWidth: '123px' }}
                                className="border-r border-[rgba(0,0,0,0.1)] dark:border-white/10 flex-shrink-0 bg-[#f9fafb] dark:bg-neutral-900 relative z-50 flex items-center"
                            >
                                {/* Native row index spacer */}
                                <div style={{ width: '43px', minWidth: '43px' }} className="h-full" />

                                {/* Select All Checkbox header exactly 40px width */}
                                <div style={{ width: '40px', minWidth: '40px' }} className="h-full flex items-center justify-center border-r border-[rgba(0,0,0,0.1)] dark:border-white/10">
                                    <Checkbox
                                        checked={filteredPages.length > 0 && selectedRowIds.size === filteredPages.length}
                                        onChange={(checked) => {
                                            if (checked) setSelectedRowIds(new Set(filteredPages.map(p => p.id)));
                                            else setSelectedRowIds(new Set());
                                        }}
                                    />
                                </div>

                                {/* Grip spacer */}
                                <div style={{ width: '40px', minWidth: '40px' }} className="h-full" />
                            </div>

                            <div ref={headerScrollRef} className="flex h-full min-w-max relative z-20" style={{ willChange: 'transform' }}>
                                {orderedVisibleProperties.map((prop: Property, i: number) => {
                                    const state = viewStateMap.get(prop.id);
                                    const storeWidth = state?.width || 150;
                                    const width = committedWidthsRef.current?.get(prop.id) ?? storeWidth;
                                    const currentWidth = resizingProperty === prop.id ? resizeOffset : width;
                                    const isDragged = colDragIndex === i;
                                    const isDropBefore = colDropTarget === i && colDragIndex !== null && colDragIndex !== i && colDragIndex !== i - 1;
                                    const isDropAfter = colDropTarget === i + 1 && colDragIndex !== null && i === orderedVisibleProperties.length - 1;

                                    return (
                                        <div
                                            key={prop.id}
                                            data-col-index={i}
                                            onPointerDown={(e) => {
                                                // Only initiate column drag on primary button, skip if resizing
                                                if (e.button !== 0 || resizingProperty === prop.id) return;
                                                // Don't start drag from resize handle area (rightmost 8px)
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                if (e.clientX > rect.right - 8) return;

                                                const startX = e.clientX;
                                                let hasMoved = false;

                                                const onMove = (me: PointerEvent) => {
                                                    if (!hasMoved && Math.abs(me.clientX - startX) < 5) return;
                                                    if (!hasMoved) {
                                                        hasMoved = true;
                                                        setColDragIndex(i);
                                                        document.body.style.cursor = 'grabbing';
                                                        document.body.style.userSelect = 'none';
                                                    }
                                                    // Find which column header the pointer is over
                                                    const headerRow = headerScrollRef.current;
                                                    if (!headerRow) return;
                                                    const headerRect = headerRow.getBoundingClientRect();
                                                    const relativeX = me.clientX - headerRect.left;
                                                    
                                                    const cols = headerRow.querySelectorAll<HTMLElement>('[data-col-index]');
                                                    let target: number | null = null;
                                                    cols.forEach((col) => {
                                                        const midX = col.offsetLeft + col.offsetWidth / 2;
                                                        const idx = parseInt(col.dataset.colIndex || '0');
                                                        if (relativeX < midX && target === null) {
                                                            target = idx;
                                                        }
                                                    });
                                                    if (target === null) target = orderedVisibleProperties.length;
                                                    colDropTargetRef.current = target;
                                                    setColDropTarget(target);
                                                };

                                                const onUp = () => {
                                                    document.body.style.cursor = '';
                                                    document.body.style.userSelect = '';
                                                    document.removeEventListener('pointermove', onMove);
                                                    document.removeEventListener('pointerup', onUp);
                                                    colDragCleanup.current = null;

                                                    if (hasMoved) {
                                                        const src = i;
                                                        const dest = colDropTargetRef.current;
                                                        setColDragIndex(null);
                                                        setColDropTarget(null);
                                                        colDropTargetRef.current = null;
                                                        if (dest !== null && dest !== src && dest !== src + 1 && databaseIdRef && activeViewId) {
                                                            const adjustedDest = dest > src ? dest - 1 : dest;
                                                            updateViewPropertyOrder(databaseIdRef, activeViewId, src, adjustedDest);
                                                        }
                                                        // Suppress the synthetic click that fires after pointerup
                                                        const suppressClick = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
                                                        document.addEventListener('click', suppressClick, { capture: true, once: true });
                                                    }
                                                };

                                                document.addEventListener('pointermove', onMove);
                                                document.addEventListener('pointerup', onUp);
                                                colDragCleanup.current = () => {
                                                    document.removeEventListener('pointermove', onMove);
                                                    document.removeEventListener('pointerup', onUp);
                                                };
                                            }}
                                            style={{ width: `${currentWidth}px`, minWidth: `${currentWidth}px`, maxWidth: `${currentWidth}px` }}
                                            className={`border-r border-[rgba(0,0,0,0.1)] dark:border-white/10 flex-shrink-0 bg-[#f9fafb] dark:bg-neutral-900 z-20 relative col-header-cell ${isDragged ? 'col-dragging' : ''}`}
                                        >
                                            {/* Blue insertion indicator — left edge */}
                                            {isDropBefore && <div className="col-drop-indicator" />}
                                            <ColumnHeader
                                                databaseId={databaseIdRef}
                                                viewId={activeViewId!}
                                                property={prop}
                                                onLiveResizeEnd={(finalWidth) => {
                                                    // Commit the final live width to the ref so the columns memo
                                                    // can read it immediately, before the store propagates.
                                                    committedWidthsRef.current.set(prop.id, finalWidth);
                                                    setGridKeySuffix(prev => prev + 1);
                                                }}
                                            />
                                            {/* Blue insertion indicator — right edge (last column only) */}
                                            {isDropAfter && <div className="col-drop-indicator col-drop-indicator-right" />}
                                        </div>
                                    );
                                })}

                                {/* Add Column button (Pro/Enterprise, user-created DBs only) */}
                                {(isPro || isEnterprise) && !isSystemDatabase(databaseIdRef) && !isAccountant && (
                                    <AddColumnButton databaseId={databaseIdRef} />
                                )}
                            </div>
                        </div>

                        <div 
                            ref={gridAreaRef} 
                            className="flex-1 w-full relative z-10 min-h-0"
                            style={resizingProperty ? { width: `calc(100% - ${resizeOffset % 2 ? 0.2 : 0}px)` } : undefined}
                        >
                            <DataSheetGrid
                                key={`${databaseIdRef}-${activeViewId || ''}-${gridKeySuffix}`}
                                value={rowData}
                                onChange={(newRows) => {
                                    if (!isMounted.current) return;

                                    // 1. Detect missing IDs to process grid-native Row deletions
                                    const newRowIds = new Set(newRows.map((r: any) => r.id).filter(Boolean));
                                    const deletedRows = rowData.filter(r => !newRowIds.has(r.id));

                                    deletedRows.forEach(deleted => {
                                        // Confirmation already handled at UI level for context-menu / toolbar deletes.
                                        // DSG native deletes (backspace key) bypass UI — propagate directly.
                                        deletePage(database.id, deleted.id);
                                    });

                                    // 2. Map properties strictly by ID to prevent index shifting bugs during deletions/sorts
                                    newRows.forEach((newRow: any) => {
                                        if (!newRow.id) {
                                            // Handle edge-case: user natively expanded grid via paste drag
                                            const newProps = newRow.properties || {};
                                            createPage(database.id, newProps);
                                            return;
                                        }

                                        const oldRow = rowData.find(r => r.id === newRow.id);
                                        if (!oldRow) return;

                                        database.properties.forEach(prop => {
                                            if (prop.type === 'rollup' || prop.type === 'formula') return;
                                            // Skip computed financial properties — they're set by the engine, not manual edits
                                            if (['totalExVat', 'totalVat', 'totalIncVat'].includes(prop.id)) return;
                                            // Block edits on records exported to accountant (exempt relation fields)
                                            if (oldRow.properties.accountantExportedAt && prop.id !== 'accountantExportedAt' && prop.type !== 'relation') {
                                                return; // silently skip — UI will show lock
                                            }

                                            let newVal;
                                            if (prop.id === 'title' || (prop.type as string) === 'relation') {
                                                newVal = newRow.properties?.[prop.id];
                                            } else {
                                                newVal = newRow[prop.id];
                                            }

                                            const oldVal = oldRow.properties[prop.id];

                                            // Normalize permutations of empty values (null, undefined, '') so the DataSheetGrid 
                                            // doesn't trigger synchronous 'auto-correction' cyclic updates during render on mount.
                                            const isDifferent = Array.isArray(newVal) && Array.isArray(oldVal)
                                                ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
                                                : (newVal ?? '') !== (oldVal ?? '');

                                            if (newVal !== undefined && isDifferent) {
                                                updatePageProperty(database.id, oldRow.id, prop.id, newVal);

                                            }
                                        });
                                    });
                                }}
                                columns={columns}
                                autoAddRow={false}
                                lockRows={isAccountant || isBestekReadOnly}
                                addRowsComponent={false}
                                disableContextMenu={isAccountant || isBestekReadOnly}
                                headerRowHeight={0}
                                height={gridHeight}
                                rowClassName={({ rowData }: { rowData: Record<string, unknown> }) => `row-id-${rowData.id} ${rowData.peppol_active ? 'peppol-active-row' : ''}`}
                                className="database-grid-custom tracking-wider"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-neutral-50/50 dark:bg-white/5 animate-pulse" />
                )}

                {/* Side-peek Modal */}
                {activePageId && (
                    <PageModal
                        databaseId={database.id}
                        pageId={activePageId}
                        onClose={() => setActivePageId(null)}
                    />
                )}

                {/* Unified Import UI */}
                <SpreadsheetImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    databaseId={database.id}
                />

                {/* ── VAT Lookup Flyout ──────────────────────────────── */}
                {vatLookup && (
                    <div
                        className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200"
                        style={{
                            top: vatLookup.anchorRect
                                ? Math.min(vatLookup.anchorRect.bottom + 8, window.innerHeight - 280)
                                : '50%',
                            left: vatLookup.anchorRect
                                ? Math.max(vatLookup.anchorRect.left, 16)
                                : '50%',
                            ...(vatLookup.anchorRect ? {} : { transform: 'translate(-50%, -50%)' }),
                        }}
                    >
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/15 rounded-2xl shadow-2xl shadow-black/20 w-[380px] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                                <div className="flex items-center gap-2">
                                    <Search className="w-4 h-4 text-orange-500" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-300">{t('db.vatLookup.title')}</span>
                                </div>
                                <button
                                    onClick={() => setVatLookup(null)}
                                    className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5 text-neutral-400" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4">
                                {/* VAT badge */}
                                <div className="flex items-center gap-2 mb-3">
                                    <code className="text-xs font-mono font-bold px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20">
                                        {vatLookup.vatNumber}
                                    </code>
                                    {vatLookup.status === 'loading' && (
                                        <span className="text-[10px] font-medium text-neutral-400 flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" /> {t('db.vatLookup.searchingRegistry')}
                                        </span>
                                    )}
                                    {vatLookup.status === 'typing' && (
                                        <span className="text-[10px] font-medium text-neutral-400 animate-pulse">
                                            {vatLookup.vatNumber.length < 10
                                                ? `${vatLookup.vatNumber.length}/10`
                                                : t('db.vatLookup.validating')}
                                        </span>
                                    )}
                                </div>

                                {/* Typing state — live hint */}
                                {vatLookup.status === 'typing' && (
                                    <div className="flex flex-col items-center justify-center py-5 gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full border-2 border-neutral-200 dark:border-white/10 flex items-center justify-center">
                                                <Search className="w-4 h-4 text-neutral-400" />
                                            </div>
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                                {t('db.vatLookup.typingHint')}
                                            </p>
                                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                                {t('db.vatLookup.vatFormat')}
                                            </p>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-full h-1 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min((vatLookup.vatNumber.length / 12) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Loading state */}
                                {vatLookup.status === 'loading' && (
                                    <div className="flex flex-col items-center justify-center py-6 gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full border-2 border-orange-200 dark:border-orange-500/30 border-t-blue-500 animate-spin" />
                                            <Search className="w-4 h-4 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                        </div>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('db.vatLookup.searchingPublic')}</p>
                                    </div>
                                )}

                                {/* Found state */}
                                {vatLookup.status === 'found' && vatLookup.data && (
                                    <div className="space-y-3">
                                        {vatLookup.data.name && (
                                            <div className="flex items-start gap-2.5">
                                                <Building2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('db.vatLookup.company')}</p>
                                                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{vatLookup.data.name}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(vatLookup.data.street || vatLookup.data.city) && (
                                            <div className="flex items-start gap-2.5">
                                                <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('db.vatLookup.address')}</p>
                                                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                                        {[vatLookup.data.street, [vatLookup.data.postalCode, vatLookup.data.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={applyVatLookup}
                                            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                                            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            {t('db.vatLookup.applyData')}
                                        </button>
                                    </div>
                                )}

                                {/* Not found */}
                                {vatLookup.status === 'not_found' && (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-neutral-500">{t('db.vatLookup.notFound')}</p>
                                        <button
                                            onClick={() => setVatLookup(null)}
                                            className="mt-3 text-xs font-semibold text-neutral-400 hover:text-neutral-600 transition-colors"
                                        >
                                            {t('db.vatLookup.dismiss')}
                                        </button>
                                    </div>
                                )}

                                {/* Error */}
                                {vatLookup.status === 'error' && (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-red-500">{t('db.vatLookup.error')}</p>
                                        <button
                                            onClick={() => setVatLookup(null)}
                                            className="mt-3 text-xs font-semibold text-neutral-400 hover:text-neutral-600 transition-colors"
                                        >
                                            {t('db.vatLookup.dismiss')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Notion-style Footer: + New button and property summaries */}
            <DatabaseFooter
                databaseId={database.id}
                viewId={activeViewId}
                lockedSchema={lockedSchema || isBestekReadOnly}
                hideNewButton={hideFooterNew || isBestekReadOnly}
                orderedVisibleProperties={orderedVisibleProperties}
                viewStateMap={viewStateMap}
                scrollRef={footerScrollRef}
                hardFilter={hardFilter}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
        .database-grid-custom {
            --dsg-border-color: rgba(0,0,0,0.1);
            --dsg-cell-background: transparent;
            --dsg-header-background: #f9fafb;
            --dsg-header-text-color: #6b7280;
            --dsg-cell-disabled-background: transparent;
            width: 100%;
            height: 100%;
            font-size: 0.875rem; /* 14px — matches Tailwind text-sm used in custom columns */
        }

        /* Normalize all DSG native inputs to match custom column font size */
        .database-grid-custom .dsg-cell {
            font-size: inherit;
        }
        .database-grid-custom .dsg-input {
            font-size: inherit !important;
        }

        /* Force DSG container to fill the available wrapper height
           so there's no white gap between the last row and the footer */
        .database-grid-custom .dsg-container {
            min-height: 100% !important;
        }

        .dark .database-grid-custom {
            --dsg-border-color: rgba(255,255,255,0.1);
            --dsg-header-background: rgba(255,255,255,0.05);
            --dsg-header-text-color: #9ca3af;
        }

        /* Column drag-and-drop animations */
        .col-header-cell {
            transition: opacity 150ms ease, background-color 150ms ease;
        }
        .col-header-cell.col-dragging {
            opacity: 0.4;
            background-color: rgba(59, 130, 246, 0.05) !important;
        }
        .col-drop-indicator {
            position: absolute;
            left: -1.5px;
            top: 2px;
            bottom: 2px;
            width: 3px;
            border-radius: 2px;
            background: #3b82f6;
            z-index: 100;
            animation: col-indicator-pulse 600ms ease-in-out infinite alternate;
        }
        .col-drop-indicator-right {
            left: auto;
            right: -1.5px;
        }
        @keyframes col-indicator-pulse {
            from { opacity: 0.7; }
            to { opacity: 1; }
        }
        .dsg-row:hover .title-open-button {
            opacity: 1 !important;
        }

        /* Peppol Active Styling */
        .peppol-active-row [class*="dsg-col-vat"] .dsg-input,
        .peppol-active-row [class*="dsg-col-btw"] .dsg-input,
        .peppol-active-row [class*="dsg-col-tva"] .dsg-input {
            color: #16a34a !important;
            font-weight: 900 !important;
            background-color: #f0fdf4 !important;
        }
        .dark .peppol-active-row [class*="dsg-col-vat"] .dsg-input,
        .dark .peppol-active-row [class*="dsg-col-btw"] .dsg-input,
        .dark .peppol-active-row [class*="dsg-col-tva"] .dsg-input {
            color: #22c55e !important;
            background-color: rgba(34, 197, 94, 0.1) !important;
        }
        `}} />
        </div>
    );
}
