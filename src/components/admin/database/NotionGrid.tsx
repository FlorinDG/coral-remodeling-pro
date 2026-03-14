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
import { Download, Upload, Plus } from 'lucide-react';
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

interface NotionGridProps {
    databaseId: string;
}

export default function NotionGrid({ databaseId }: NotionGridProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const createPage = useDatabaseStore(state => state.createPage);
    const [activePageId, setActivePageId] = useState<string | null>(null);

    // Subscribe to store changes manually for this specific DB to avoid full-app re-renders
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));

    const [isReady, setIsReady] = useState(false);
    const isMounted = useRef(false);
    useEffect(() => {
        isMounted.current = true;
        // Delay mounting the grid slightly to ensure the parent flex-box layout 
        // has fully stabilized its pixel dimensions across all sidebars/paddings.
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => {
            isMounted.current = false;
            clearTimeout(timer);
        };
    }, []);

    // Use properties reference directly to avoid recreating columns when page data updates (which changes database reference)
    const databaseProperties = database?.properties;
    const databaseIdRef = database?.id;

    const columns = useMemo<Column<any, any>[]>(() => {
        if (!databaseProperties || !databaseIdRef) return [];

        return databaseProperties.map(prop => {
            // Because TitleColumn operates on the full row data, we handle it separately
            if (prop.id === 'title') {
                return {
                    ...titleColumn(prop.id, (row) => setActivePageId(row.id)),
                    title: <ColumnHeader databaseId={databaseIdRef} property={prop} />,
                    minWidth: 150
                };
            }

            // Rollups also need full row data to read sibling relation properties
            if (prop.type === 'rollup' && prop.config?.rollupPropertyId && prop.config?.rollupTargetPropertyId) {
                return {
                    ...rollupColumn(prop.config.rollupPropertyId, prop.config.rollupTargetPropertyId) as any,
                    title: <ColumnHeader databaseId={databaseIdRef} property={prop} />,
                    minWidth: 150
                };
            }

            // Relations need full row data to allow precise multi-select array mutations
            if (prop.type === 'relation' && prop.config?.relationDatabaseId) {
                return {
                    ...relationColumn(prop.id, prop.config.relationDatabaseId) as any,
                    title: <ColumnHeader databaseId={databaseIdRef} property={prop} />,
                    minWidth: 150
                };
            }

            // Formulas evaluate mathematical logic against row data dynamically
            if (prop.type === 'formula' && prop.config?.formulaExpression) {
                return {
                    ...formulaColumn(prop.config.formulaExpression, databaseIdRef) as any,
                    title: <ColumnHeader databaseId={databaseIdRef} property={prop} />,
                    minWidth: 150
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
                title: <ColumnHeader databaseId={databaseIdRef} property={prop} />,
                minWidth: 150
            };
        });
    }, [databaseProperties, databaseIdRef]);

    if (!database) return null;

    // Execute Client-Side Filtering
    const filteredPages = useMemo(() => {
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
    }, [database.pages, database.activeFilters]);

    // Execute Client-Side Sorting
    const sortedPages = useMemo(() => {
        return [...filteredPages].sort((a, b) => {
            if (!database.activeSorts || database.activeSorts.length === 0) return 0;

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
    }, [filteredPages, database.activeSorts]);

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
                            const propDef = database.properties.find(p => p.id === propId);
                            if (propDef?.type === 'multi_select' && typeof val === 'string') {
                                initialProps[propId] = val.split(',').map(s => s.trim()).filter(Boolean);
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

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 flex items-center justify-between">
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
                        onClick={() => createPage(database.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">New Row</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col w-full">
                <FilterToolbar databaseId={database.id} />
                <SortToolbar databaseId={database.id} />
            </div>

            <div className="flex-1 w-full p-0 relative overflow-hidden">
                {isReady ? (
                    <DataSheetGrid
                        value={rowData}
                        onChange={(newRows) => {
                            console.trace("DataSheetGrid onChange fired. isMounted:", isMounted.current);
                            // Prevent DataSheetGrid from attempting to normalize rows during the initial Next.js render pass
                            if (!isMounted.current) return;

                            newRows.forEach((newRow: any, index) => {
                                const oldRow = rowData[index];
                                if (!oldRow) return;

                                database.properties.forEach(prop => {
                                    if (prop.type === 'rollup' || prop.type === 'formula') return; // Read-only

                                    // Determine where the new value is stored based on if it bypassed keyColumn
                                    let newVal;
                                    if (prop.id === 'title' || (prop.type as string) === 'relation') {
                                        newVal = newRow.properties?.[prop.id];
                                    } else {
                                        newVal = newRow[prop.id];
                                    }

                                    const oldVal = oldRow.properties[prop.id];

                                    // Deep comparison for arrays (like relations)
                                    const isDifferent = Array.isArray(newVal) && Array.isArray(oldVal)
                                        ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
                                        : newVal !== oldVal;

                                    if (newVal !== undefined && isDifferent) {
                                        updatePageProperty(database.id, oldRow.id, prop.id, newVal);
                                    }
                                });
                            });
                        }}
                        columns={columns}
                        autoAddRow={false} // Custom add button handles this
                        lockRows={false}
                        className="h-full database-grid-custom"
                    />
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
        
        /* Prevent parent scrollbars from flickering when internal grid calculates width */
        .dsg-container {
            overflow: hidden !important;
            width: 100% !important;
            max-width: 100% !important;
        }

        /* Prevent fractional width calculation jitter in ResizeObserver and kill the vertical scrollbar battle loop */
        .dsg-scrollable-view {
            width: 100% !important;
            overflow-y: scroll !important;
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
