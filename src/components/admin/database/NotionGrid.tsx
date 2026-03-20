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
import { Download, Upload, Plus, GripVertical, Trash, Copy, Maximize2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/time-tracker/components/ui/dropdown-menu';
import { selectColumn } from './columns/SelectColumn';
import { dateColumn } from './columns/DateColumn';
import ColumnHeader from './components/ColumnHeader';
import FilterToolbar from './components/FilterToolbar';
import SortToolbar from './components/SortToolbar';
import { titleColumn } from './columns/TitleColumn';
import { relationColumn } from './columns/RelationColumn';
import { rollupColumn } from './columns/RollupColumn';
import { formulaColumn } from './columns/FormulaColumn';
import PageModal from './components/PageModal';
import PropertiesDropdown from './components/PropertiesDropdown';
import { Property } from './types';

interface NotionGridProps {
    databaseId: string;
}

export default function NotionGrid({ databaseId }: NotionGridProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);
    const deletePage = useDatabaseStore(state => state.deletePage);
    const updateViewPropertyOrder = useDatabaseStore(state => state.updateViewPropertyOrder);
    const updatePageOrder = useDatabaseStore(state => state.updatePageOrder);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [resizingProperty, setResizingProperty] = useState<string | null>(null);
    const [resizeOffset, setResizeOffset] = useState<number>(0);

    // Subscribe to store changes manually for this specific DB to avoid full-app re-renders
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const activeViewId = database?.views?.[0]?.id; // Defaulting to first view for now, will add tabs later
    const activeView = database?.views?.find(v => v.id === activeViewId);

    const [isReady, setIsReady] = useState(false);
    const [hasHydrated, setHasHydrated] = useState(false);
    const isMounted = useRef(false);
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const gridWrapperRef = useRef<HTMLDivElement>(null);

    // Sync header scroll with grid scroll to ensure columns align horizontally
    useEffect(() => {
        if (!isReady) return;

        const gridContainer = gridWrapperRef.current?.querySelector('.dsg-container');

        const handleScroll = (e: Event) => {
            if (headerScrollRef.current && e.target instanceof Element) {
                headerScrollRef.current.style.transform = `translateX(-${e.target.scrollLeft}px)`;
            }
        };

        if (gridContainer) {
            gridContainer.addEventListener('scroll', handleScroll, { passive: true });
        }

        return () => {
            if (gridContainer) {
                gridContainer.removeEventListener('scroll', handleScroll);
            }
        };
    }, [isReady]);
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
    const databaseProperties = database?.properties || [];
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
                        ...titleColumn(prop.id, (row) => setActivePageId(row.id)),
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
                        ...rollupColumn(prop.config.rollupPropertyId, prop.config.rollupTargetPropertyId) as any,
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
                        ...relationColumn(prop.id, prop.config.relationDatabaseId) as any,
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
                    baseColumn = selectColumn({ choices: prop.config?.options || [] }) as any;
                } else if (prop.type === 'date') {
                    baseColumn = dateColumn as any;
                }
                // More custom columns like Number will go here later

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

        // Prepend native HTML5 drag-and-drop Grip handle column
        return [
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
                            <DropdownMenuItem
                                onClick={() => deletePage(databaseIdRef, rowData.id)}
                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                            >
                                <Trash className="w-4 h-4 mr-2" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
            ...mappedProperties
        ]
    }, [databaseProperties, databaseIdRef, activeViewId, activeView?.propertiesState, viewStateMap, orderedVisibleProperties, columnWidthsHash]);


    const filteredPages = useMemo(() => {
        if (!database) return [];
        return database.pages.filter(page => {
            if (!database.activeFilters || database.activeFilters.length === 0) return true;

            return database.activeFilters.every(filter => {
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
    }, [database?.pages, database?.activeFilters]);

    // Execute Client-Side Sorting
    const sortedPages = useMemo(() => {
        if (!database) return [];
        return [...filteredPages].sort((a, b) => {
            if (!database.activeSorts || database.activeSorts.length === 0) {
                return (a.order ?? 0) - (b.order ?? 0);
            }

            for (const sort of database.activeSorts) {
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
    }, [filteredPages, database?.activeSorts]);

    // Convert sorted filtered pages to row data by flattening properties to the top level for data-sheet-grid access
    // Memoizing this to prevent infinite re-renders or synchronous onChange triggers from DataSheetGrid
    const rowData = useMemo(() => sortedPages.map(page => ({
        ...page,
        ...page.properties
    })), [sortedPages]);

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

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !database) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Map the CSV headers back to property IDs
                const headerToPropId: Record<string, string> = {};
                database.properties.forEach(p => {
                    headerToPropId[p.name] = p.id;
                    headerToPropId[p.name.toLowerCase()] = p.id;
                });

                results.data.forEach((row: any) => {
                    const initialProps: Record<string, any> = {};

                    Object.keys(row).forEach(header => {
                        const propId = headerToPropId[header] || headerToPropId[header.toLowerCase()];
                        if (propId) {
                            const val = row[header];
                            if (val === undefined || val === null || val === '') return;

                            const propDef = database.properties.find(p => p.id === propId);

                            // Transform human-readable CSV string values back into internal Option IDs for select fields
                            if (propDef?.type === 'multi_select' && typeof val === 'string') {
                                const optionNames = val.split(',').map(s => s.trim()).filter(Boolean);
                                initialProps[propId] = optionNames.map(name => {
                                    const match = propDef.config?.options?.find((o: any) => o.name.toLowerCase() === name.toLowerCase());
                                    return match ? match.id : name;
                                });
                            } else if (propDef?.type === 'select' && typeof val === 'string') {
                                const match = propDef.config?.options?.find((o: any) => o.name.toLowerCase() === val.trim().toLowerCase());
                                initialProps[propId] = match ? match.id : val;
                            } else {
                                initialProps[propId] = val;
                            }
                        }
                    });

                    // Add standard missing properties with default empty strings
                    database.properties.forEach(p => {
                        if (initialProps[p.id] === undefined) initialProps[p.id] = '';
                    });

                    createPage(database.id, initialProps);
                });

                // Clear the input
                e.target.value = '';
            }
        });
    };

    if (!database || !hasHydrated) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm relative">
            <div className="p-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 flex items-center justify-between relative z-[60]">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        {database.icon && <span>{database.icon}</span>}
                        {database.name}
                        <span className="text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full ml-2">
                            {filteredPages.length} Rows
                        </span>
                    </h2>
                    {database.description && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{database.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {activeViewId && <PropertiesDropdown databaseId={database.id} viewId={activeViewId} />}
                    <FilterToolbar databaseId={database.id} />
                    <SortToolbar databaseId={database.id} />

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Export</span>
                    </button>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition shadow-sm cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span className="hidden md:inline">Import</span>
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleImportCSV}
                        />
                    </label>

                    <button
                        onClick={() => {
                            createPage(database.id);
                            // Scroll to bottom so the new row is visible
                            setTimeout(() => {
                                const gridContainer = gridWrapperRef.current?.querySelector('.dsg-container');
                                if (gridContainer) {
                                    gridContainer.scrollTo({
                                        top: gridContainer.scrollHeight,
                                        behavior: 'smooth'
                                    });
                                }
                            }, 150);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">New Row</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full p-0 relative overflow-hidden min-h-0" ref={gridWrapperRef}>
                {isReady ? (
                    <div className="w-full h-full flex flex-col pt-9 relative">
                        {/* Custom Floating Header context to override native grid pointer events */}
                        <div
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            className="absolute top-0 left-0 right-0 h-9 z-50 flex bg-[#f9fafb] dark:bg-neutral-900 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 overflow-visible pointer-events-auto"
                        >
                            {/* React DataSheet Grid Row Number Gutter Spacer (43px) + Native Custom Grip Handler Spacer (40px) = 83px total left gutter */}
                            <div className="w-[83px] border-r border-[rgba(0,0,0,0.1)] dark:border-white/10 flex-shrink-0 bg-[#f9fafb] dark:bg-neutral-900 relative z-50" />

                            <div ref={headerScrollRef} className="flex h-full min-w-max relative z-20" style={{ transform: 'translateX(0px)', willChange: 'transform' }}>
                                {orderedVisibleProperties.map((prop: Property, i: number) => {
                                    const state = viewStateMap.get(prop.id);
                                    const width = state?.width || 150;
                                    const currentWidth = resizingProperty === prop.id ? resizeOffset : width;

                                    return (
                                        <div
                                            key={prop.id}
                                            style={{ width: `${currentWidth}px`, minWidth: `${currentWidth}px`, maxWidth: `${currentWidth}px` }}
                                            className="border-r border-[rgba(0,0,0,0.1)] dark:border-white/10 flex-shrink-0 bg-[#f9fafb] dark:bg-neutral-900 z-20 relative"
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
            </div>

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
