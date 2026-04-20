"use client";

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useDatabaseStore } from './store';
import {
    DataSheetGrid,
    textColumn,
    keyColumn,
    checkboxColumn,
    Column
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';
import { Download, Upload, GripVertical, Trash, Copy, Maximize2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/time-tracker/components/ui/dropdown-menu';
import { useTenant } from '@/context/TenantContext';
import { selectColumn } from './columns/SelectColumn';
import { dateColumn } from './columns/DateColumn';
import ColumnHeader from './components/ColumnHeader';
import FilterToolbar from './components/FilterToolbar';
import SortToolbar from './components/SortToolbar';
import { titleColumn } from './columns/TitleColumn';
import { relationColumn } from './columns/RelationColumn';
import { rollupColumn } from './columns/RollupColumn';
import { formulaColumn } from './columns/FormulaColumn';
import { currencyColumn } from './columns/CurrencyColumn';
import { variantsColumn } from './columns/VariantsColumn';
import PageModal from './components/PageModal';
import PropertiesDropdown from './components/PropertiesDropdown';
import { SpreadsheetImportModal } from './components/SpreadsheetImportModal';
import DatabaseFooter from './components/DatabaseFooter';
import { Property } from './types';

interface NotionGridProps {
    databaseId: string;
    viewId?: string;
    renderTabs?: React.ReactNode;
    lockedSchema?: boolean;
    preventDelete?: boolean;
    hideFooterNew?: boolean;
    hardFilter?: { propertyId: string; value: string };
}

export default function NotionGrid({ databaseId, viewId, renderTabs, lockedSchema, preventDelete, hideFooterNew, hardFilter }: NotionGridProps) {
    const router = useRouter();
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);
    const addPages = useDatabaseStore(state => state.addPages);
    const deletePage = useDatabaseStore(state => state.deletePage);
    const deletePages = useDatabaseStore(state => state.deletePages);
    const updateViewPropertyOrder = useDatabaseStore(state => state.updateViewPropertyOrder);
    const updatePageOrder = useDatabaseStore(state => state.updatePageOrder);
    const addProperty = useDatabaseStore(state => state.addProperty);
    const clearDatabase = useDatabaseStore(state => state.clearDatabase);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [resizingProperty, setResizingProperty] = useState<string | null>(null);
    const [resizeOffset, setResizeOffset] = useState<number>(0);

    // Subscribe to store changes manually for this specific DB to avoid full-app re-renders
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const activeViewId = viewId || database?.views?.[0]?.id; // prioritize explicitly passed viewId from tab engine
    const activeView = database?.views?.find(v => v.id === activeViewId);

    const { activeModules } = useTenant();
    const hasCRM = activeModules.includes('CRM');

    const [isReady, setIsReady] = useState(false);
    const [hasHydrated, setHasHydrated] = useState(false);
    const isMounted = useRef(false);
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const gridWrapperRef = useRef<HTMLDivElement>(null);

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

    // Use properties reference directly to avoid recreating columns when page data updates (which changes database reference)
    let databaseProperties = database?.properties || [];

    // ENFORCE LICENSING ISOLATION: Hide 'Lead Source' property for Free Tier
    if (!hasCRM && databaseId === 'db-clients') {
        databaseProperties = databaseProperties.filter(p => p.name.toLowerCase() !== 'lead source');
    }

    const databaseIdRef = database?.id || '';

    const viewStateMap = useMemo(() => new Map(activeView?.propertiesState?.map(ps => [ps.propertyId, ps]) || []), [activeView?.propertiesState]);

    const orderedVisibleProperties = useMemo(() => {
        return [...databaseProperties]
            .filter(prop => {
                const state = viewStateMap.get(prop.id);
                return !state?.hidden;
            })
            .sort((a, b) => {
                const orderA = viewStateMap.get(a.id)?.order ?? 999;
                const orderB = viewStateMap.get(b.id)?.order ?? 999;
                return orderA - orderB;
            });
    }, [databaseProperties, viewStateMap]);

    // Deeply stringify the critical widths to force React to trigger the columns useMemo when a drag ends
    const columnWidthsHash = useMemo(() => {
        return orderedVisibleProperties.map(p => `${p.id}:${viewStateMap.get(p.id)?.width || 150}`).join('|');
    }, [orderedVisibleProperties, viewStateMap]);

    const columns = useMemo<Column<any, any>[]>(() => {
        if (!databaseProperties.length || !databaseIdRef || !activeViewId) return [];

        const columnTraceLogs = orderedVisibleProperties.map(p => `${p.id}:${viewStateMap.get(p.id)?.width || 150}`).join(', ');
        console.log("NotionGrid Rebuilding Columns! ->", columnTraceLogs);

        const mappedProperties = orderedVisibleProperties
            .map((prop: Property, i: number) => {
                const state = viewStateMap.get(prop.id);
                const columnWidth = state?.width || 150;
                const currentWidth = resizingProperty === prop.id ? resizeOffset : columnWidth;
                const GhostHeader = <div className="hidden" />;

                // Because TitleColumn operates on the full row data, we handle it separately
                if (prop.id === 'title') {
                    return {
                        ...titleColumn(prop.id, (row) => {
                            // Use prefix matching to handle both bare ('db-quotations')
                            // and tenant-scoped ('db-quotations-abc12345') IDs
                            if (databaseIdRef === 'db-quotations' || databaseIdRef.startsWith('db-quotations-')) {
                                router.push(`/admin/quotations/${row.id}`);
                            } else if (databaseIdRef === 'db-invoices' || databaseIdRef.startsWith('db-invoices-')) {
                                router.push(`/admin/financials/income/invoices/${row.id}`);
                            } else {
                                setActivePageId(row.id);
                            }
                        }),
                        title: GhostHeader,
                        basis: columnWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: columnWidth,
                        maxWidth: columnWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Rollups also need full row data to read sibling relation properties
                if (prop.type === 'rollup' && prop.config?.rollupPropertyId && prop.config?.rollupTargetPropertyId) {
                    return {
                        ...rollupColumn(prop.config.rollupPropertyId, prop.config.rollupTargetPropertyId, prop.config.rollupAggregation) as any,
                        title: GhostHeader,
                        basis: columnWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: columnWidth,
                        maxWidth: columnWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Relations need full row data to allow precise multi-select array mutations
                if (prop.type === 'relation' && prop.config?.relationDatabaseId) {
                    return {
                        ...relationColumn(prop.id, prop.config.relationDatabaseId, prop.config.relationDisplayPropertyId) as any,
                        title: GhostHeader,
                        basis: columnWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: columnWidth,
                        maxWidth: columnWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Formulas evaluate mathematical logic against row data dynamically
                if (prop.type === 'formula' && prop.config?.formulaExpression) {
                    return {
                        ...formulaColumn(prop.config.formulaExpression, databaseIdRef) as any,
                        title: GhostHeader,
                        basis: columnWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: columnWidth,
                        maxWidth: columnWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Map our PropertyType to react-datasheet-grid columns for other types
                let baseColumn = textColumn;

                if (prop.type === 'checkbox') {
                    baseColumn = checkboxColumn as any;
                } else if (prop.type === 'select' || prop.type === 'multi_select') {
                    // Full-row column — no keyColumn wrapping needed.
                    // onCommit calls updatePageProperty directly, bypassing the
                    // setRowData → onChange → updatePageProperty timing race.
                    baseColumn = selectColumn({
                        choices: prop.config?.options || [],
                        propId: prop.id,
                        onCommit: (rowId, value) => database && updatePageProperty(database.id, rowId, prop.id, value),
                    }) as any;
                } else if (prop.type === 'date') {
                    baseColumn = dateColumn as any;
                } else if (prop.type === 'currency' || prop.type === 'number') {
                    const symbol = prop.config?.format === 'dollar' ? '$' : '€';
                    const isComputed = ['totalExVat', 'totalVat', 'totalIncVat'].includes(prop.id);
                    baseColumn = currencyColumn(prop.id, prop.type === 'currency' ? symbol : '', isComputed) as any;
                } else if (prop.type === 'variants') {
                    baseColumn = variantsColumn as any;
                }
                // More custom columns like Number will go here later

                // Select/multi_select use keyColumn for all OTHER types:
                // they directly call onCommit — no keyColumn needed.
                if (prop.type === 'select' || prop.type === 'multi_select') {
                    return {
                        ...baseColumn,
                        title: GhostHeader,
                        basis: columnWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: columnWidth,
                        maxWidth: columnWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                return {
                    ...keyColumn(prop.id, baseColumn),
                    title: GhostHeader,
                    basis: columnWidth,
                    grow: 0,
                    shrink: 0,
                    minWidth: columnWidth,
                    maxWidth: columnWidth,
                    cellClassName: `dsg-col-${prop.id}`
                };
            });

        // Prepend Selection Checkbox Col and native HTML5 drag-and-drop Grip handle column
        return [
            {
                title: <div className="hidden" />,
                basis: 40,
                grow: 0,
                shrink: 0,
                minWidth: 40,
                maxWidth: 40,
                component: ({ rowData }) => (
                    <div
                        className="w-full h-full flex items-center justify-center cursor-default bg-neutral-50 dark:bg-black/50 border-r border-neutral-200 dark:border-white/10"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input
                            type="checkbox"
                            checked={rowData._isSelected || false}
                            onChange={(e) => {
                                const isChecked = e.target.checked;
                                setSelectedRowIds(prevSet => {
                                    const next = new Set(prevSet);
                                    if (isChecked) next.add(rowData.id);
                                    else next.delete(rowData.id);
                                    return next;
                                });
                            }}
                            className="w-3.5 h-3.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                    </div>
                )
            },
            {
                title: <div className="hidden" />,
                basis: 40,
                grow: 0,
                shrink: 0,
                minWidth: 40,
                maxWidth: 40,
                component: ({ rowIndex, rowData }) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', rowIndex.toString());
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                    if (!isNaN(sourceIndex) && sourceIndex !== rowIndex && databaseIdRef) {
                                        updatePageOrder(databaseIdRef, sourceIndex, rowIndex);
                                    }
                                }}
                                className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition bg-neutral-50 dark:bg-black/50"
                            >
                                <GripVertical size={16} />
                            </div>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="start" className="w-48 z-[100] shadow-xl">
                            <DropdownMenuItem onClick={() => setActivePageId(rowData.id)} className="cursor-pointer">
                                <Maximize2 className="w-4 h-4 mr-2" />
                                <span>Open</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                                const newProps = { ...rowData.properties };
                                if (newProps.title) {
                                    newProps.title = `${newProps.title} (Copy)`;
                                }
                                createPage(databaseIdRef, newProps);
                            }} className="cursor-pointer">
                                <Copy className="w-4 h-4 mr-2" />
                                <span>Duplicate</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!preventDelete && (
                            <DropdownMenuItem
                                onClick={() => deletePage(databaseIdRef, rowData.id)}
                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                            >
                                <Trash className="w-4 h-4 mr-2" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
            ...mappedProperties
        ]
    }, [databaseProperties, databaseIdRef, activeViewId, activeView?.propertiesState, viewStateMap, orderedVisibleProperties, columnWidthsHash, selectedRowIds]);


    const filteredPages = useMemo(() => {
        if (!database) return [];
        const activeFilters = activeView?.filters || database.activeFilters || [];

        return database.pages.filter(page => {
            // Apply immutable hard filter first (e.g. docType partitioning)
            if (hardFilter) {
                const cellVal = page.properties[hardFilter.propertyId];
                const resolvedVal = cellVal ? String(cellVal) : 'opt-invoice'; // Backwards compat: existing records without docType are invoices
                if (resolvedVal !== hardFilter.value) return false;
            }

            if (!activeFilters || activeFilters.length === 0) return true;

            return activeFilters.every(filter => {
                const cellValue = page.properties[filter.propertyId];

                switch (filter.operator) {
                    case 'equals': return String(cellValue) === String(filter.value);
                    case 'does_not_equal': return String(cellValue) !== String(filter.value);
                    case 'contains': return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'does_not_contain': return !String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'is_empty': return !cellValue || cellValue === '';
                    case 'is_not_empty': return !!cellValue && cellValue !== '';
                    default: return true;
                }
            });
        });
    }, [database?.pages, activeView?.filters, database?.activeFilters, hardFilter]);

    // Execute Client-Side Sorting
    const sortedPages = useMemo(() => {
        if (!database) return [];
        const activeSorts = activeView?.sorts || database.activeSorts || [];

        return [...filteredPages].sort((a, b) => {
            if (!activeSorts || activeSorts.length === 0) {
                return (a.order ?? 0) - (b.order ?? 0);
            }

            for (const sort of activeSorts) {
                const valA = a.properties[sort.propertyId];
                const valB = b.properties[sort.propertyId];

                if (valA === valB) continue;

                const isAsc = sort.direction === 'ascending';

                if (!valA) return isAsc ? 1 : -1;
                if (!valB) return isAsc ? -1 : 1;

                if (valA < valB) return isAsc ? -1 : 1;
                if (valA > valB) return isAsc ? 1 : -1;
            }

            return 0;
        });
    }, [filteredPages, activeView?.sorts, database?.activeSorts]);

    // Convert sorted filtered pages to row data by flattening properties to the top level for data-sheet-grid access
    // Memoizing this to prevent infinite re-renders or synchronous onChange triggers from DataSheetGrid
    const rowData = useMemo(() => sortedPages.map(page => ({
        ...page,
        ...page.properties,
        _isSelected: selectedRowIds.has(page.id),
        // Force DSG cell re-render when property values change by including a lightweight hash
        _propHash: JSON.stringify(page.properties)
    })), [sortedPages, selectedRowIds]);


    const handleExportCSV = () => {
        if (!database) return;

        // Prepare rows (using sortedPages so it respects current filters)
        const csvData = sortedPages.map(page => {
            const row: Record<string, string> = {};
            database.properties.forEach(p => {
                const val = page.properties[p.id];
                // basic stringification for CSV
                if (val === undefined || val === null) {
                    row[p.name] = '';
                } else if (Array.isArray(val)) {
                    row[p.name] = val.map(String).join(', ');
                } else {
                    row[p.name] = String(val);
                }
            });
            return row;
        });

        const csvContent = Papa.unparse(csvData);

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${database.name}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

                    {!lockedSchema && (
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Export</span>
                    </button>
                    )}

                    {!lockedSchema && (
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Import</span>
                    </button>
                    )}

                    {!preventDelete && (
                    <button
                        onClick={() => {
                            if (selectedRowIds.size > 0) {
                                if (window.confirm(`Are you sure you want to permanently delete ${selectedRowIds.size} selected rows?`)) {
                                    deletePages(database.id, Array.from(selectedRowIds));
                                    setSelectedRowIds(new Set());
                                }
                            } else {
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

            <div
                className="flex-1 w-full p-0 relative overflow-hidden min-h-0 bg-white dark:bg-black"
                ref={gridWrapperRef}
                onScrollCapture={(e) => {
                    // Synchronously intercept bubbled scroll events and lock the header offset translation
                    const target = e.target as HTMLElement;
                    if (target.classList?.contains('dsg-container') && headerScrollRef.current) {
                        headerScrollRef.current.style.transform = `translateX(-${target.scrollLeft}px)`;
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
                    <div className="w-full h-full flex flex-col pt-9 relative">
                        {/* Custom Floating Header context to override native grid pointer events */}
                        <div
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onWheel={e => {
                                const gridContainer = gridWrapperRef.current?.querySelector('.dsg-container');
                                if (gridContainer && Math.abs(e.deltaX) > 0) {
                                    gridContainer.scrollLeft += e.deltaX;
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
                                    <input
                                        type="checkbox"
                                        checked={filteredPages.length > 0 && selectedRowIds.size === filteredPages.length}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedRowIds(new Set(filteredPages.map(p => p.id)));
                                            else setSelectedRowIds(new Set());
                                        }}
                                        className="w-3.5 h-3.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </div>

                                {/* Grip spacer */}
                                <div style={{ width: '40px', minWidth: '40px' }} className="h-full" />
                            </div>

                            <div ref={headerScrollRef} className="flex h-full min-w-max relative z-20" style={{ willChange: 'transform' }}>
                                {orderedVisibleProperties.map((prop: Property, i: number) => {
                                    const state = viewStateMap.get(prop.id);
                                    const width = state?.width || 150;
                                    const currentWidth = resizingProperty === prop.id ? resizeOffset : width;

                                    return (
                                        <div
                                            key={prop.id}
                                            draggable={resizingProperty !== prop.id}
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('column-index', i.toString());
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const sourceIndex = parseInt(e.dataTransfer.getData('column-index'));
                                                if (!isNaN(sourceIndex) && sourceIndex !== i && databaseIdRef && activeViewId) {
                                                    updateViewPropertyOrder(databaseIdRef, activeViewId, sourceIndex, i);
                                                }
                                            }}
                                            style={{ width: `${currentWidth}px`, minWidth: `${currentWidth}px`, maxWidth: `${currentWidth}px` }}
                                            className="border-r border-[rgba(0,0,0,0.1)] dark:border-white/10 flex-shrink-0 bg-[#f9fafb] dark:bg-neutral-900 z-20 relative transition-transform"
                                        >
                                            <ColumnHeader
                                                databaseId={databaseIdRef}
                                                viewId={activeViewId!}
                                                property={prop}
                                                index={i}
                                                onLiveResize={(w) => { setResizingProperty(prop.id); setResizeOffset(w); }}
                                                onLiveResizeEnd={() => { setResizingProperty(null); }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 w-full relative z-10">
                            <DataSheetGrid
                                key={columnWidthsHash}
                                value={rowData}
                                onChange={(newRows) => {
                                    if (!isMounted.current) return;

                                    // 1. Detect missing IDs to process grid-native Row deletions
                                    const newRowIds = new Set(newRows.map((r: any) => r.id).filter(Boolean));
                                    const deletedRows = rowData.filter(r => !newRowIds.has(r.id));

                                    deletedRows.forEach(deleted => {
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
                                            // Skip select/multi_select — committed directly via onCommit in SelectColumn,
                                            // bypassing this path to avoid a DSG stopEditing timing race
                                            if (prop.type === 'select' || prop.type === 'multi_select') return;

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
                                lockRows={false}
                                addRowsComponent={false}
                                headerRowHeight={0}
                                className="h-full database-grid-custom tracking-wider"
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
            </div>

            {/* Notion-style Footer: + New button and property summaries */}
            <DatabaseFooter
                databaseId={database.id}
                viewId={activeViewId}
                lockedSchema={lockedSchema}
                hideNewButton={hideFooterNew}
                orderedVisibleProperties={orderedVisibleProperties}
                viewStateMap={viewStateMap}
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
        }

        .dark .database-grid-custom {
            --dsg-border-color: rgba(255,255,255,0.1);
            --dsg-header-background: rgba(255,255,255,0.05);
            --dsg-header-text-color: #9ca3af;
        }
        `}} />
        </div>
    );
}
