/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/preserve-manual-memoization */
import React, { useMemo } from 'react';
import {
    textColumn,
    keyColumn,
    Column
} from 'react-datasheet-grid';
import { GripVertical, Trash, Copy, Maximize2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/time-tracker/components/ui/dropdown-menu';
import { Checkbox } from '@/components/common/Checkbox';
import { selectColumn } from '../columns/SelectColumn';
import { dateColumn } from '../columns/DateColumn';
import { titleColumn } from '../columns/TitleColumn';
import { relationColumn } from '../columns/RelationColumn';
import { rollupColumn } from '../columns/RollupColumn';
import { formulaColumn } from '../columns/FormulaColumn';
import { currencyColumn } from '../columns/CurrencyColumn';
import { variantsColumn } from '../columns/VariantsColumn';
import { metaDateColumn } from '../columns/MetaDateColumn';
import { checkboxColumnCustom } from '../columns/CheckboxColumn';
import type { Property, ViewPropertyState } from '../types';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface UseGridColumnsParams {
    databaseId: string;
    databaseIdRef: string;
    activeViewId: string | undefined;
    orderedVisibleProperties: Property[];
    viewStateMap: Map<string, ViewPropertyState>;
    resizingProperty: string | null;
    resizeOffset: number;
    committedWidthsRef: React.RefObject<Map<string, number>>;
    isBestekReadOnly: boolean;
    isFree: boolean;
    preventDelete?: boolean | ((rowData: any) => boolean);
    router: AppRouterInstance;
    // Store actions & local state setters
    updatePageProperty: (databaseId: string, pageId: string, propertyId: string, value: any) => void;
    updatePageOrder: (databaseId: string, sourceIndex: number, destinationIndex: number) => void;
    createPage: (databaseId: string, initialProperties?: Record<string, any>, customId?: string, initialBlocks?: any[]) => any;
    deletePage: (databaseId: string, pageId: string) => void;
    setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setActivePageId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Builds the column configuration array for DataSheetGrid.
 *
 * Maps each visible property to the correct DSG column type (title, select,
 * date, currency, formula, relation, rollup, etc.) and prepends the selection
 * checkbox and drag-handle grip columns.
 */
export function useGridColumns({
    databaseIdRef,
    databaseId,
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
    setActivePageId,
}: UseGridColumnsParams): Column<any, any>[] {
    return useMemo<Column<any, any>[]>(() => {
        const propsCount = orderedVisibleProperties.length;
        if (!propsCount || !databaseIdRef || !activeViewId) return [];

        const mappedProperties = orderedVisibleProperties
            .map((prop: Property, i: number) => {
                const state = viewStateMap.get(prop.id);
                const storeWidth = state?.width || 150;
                // During live drag: use the live offset.
                // After drag end: viewStateMap may still be stale (same React batch),
                // so fall back to the committed width ref.
                const columnWidth = committedWidthsRef.current?.get(prop.id) ?? storeWidth;
                const currentWidth = resizingProperty === prop.id ? resizeOffset : columnWidth;
                const GhostHeader = <div className="hidden" />;

                // Because TitleColumn operates on the full row data, we handle it separately
                if (prop.id === 'title') {
                    const isFinancialDb =
                        databaseIdRef === 'db-quotations' || databaseIdRef.startsWith('db-quotations-') ||
                        databaseIdRef === 'db-invoices'   || databaseIdRef.startsWith('db-invoices-');

                    return {
                        ...titleColumn(
                            prop.id,
                            // Single OPEN action: financial DBs → engine, non-financial/all others → side-peek modal directly
                            (row) => {
                                if (databaseIdRef === 'db-quotations' || databaseIdRef.startsWith('db-quotations-')) {
                                    router.push(`/admin/quotations/${row.id}`);
                                } else if (databaseIdRef === 'db-invoices' || databaseIdRef.startsWith('db-invoices-')) {
                                    router.push(`/admin/financials/income/invoices/${row.id}`);
                                } else {
                                    setActivePageId(row.id);
                                }
                            },
                        ),
                        title: GhostHeader,
                        basis: currentWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: currentWidth,
                        maxWidth: currentWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Rollups also need full row data to read sibling relation properties
                if (prop.type === 'rollup' && prop.config?.rollupPropertyId && prop.config?.rollupTargetPropertyId) {
                    return {
                        ...rollupColumn(prop.config.rollupPropertyId, prop.config.rollupTargetPropertyId, prop.config.rollupAggregation) as any,
                        title: GhostHeader,
                        basis: currentWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: currentWidth,
                        maxWidth: currentWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Relations need full row data to allow precise multi-select array mutations
                if (prop.type === 'relation' && prop.config?.relationDatabaseId) {
                    return {
                        ...relationColumn(prop.id, prop.config.relationDatabaseId, prop.config.relationDisplayPropertyId) as any,
                        title: GhostHeader,
                        basis: currentWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: currentWidth,
                        maxWidth: currentWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Formulas evaluate mathematical logic against row data dynamically
                if (prop.type === 'formula' && prop.config?.formulaExpression) {
                    return {
                        ...formulaColumn(prop.config.formulaExpression, databaseIdRef, prop.id) as any,
                        title: GhostHeader,
                        basis: currentWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: currentWidth,
                        maxWidth: currentWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                // Map our PropertyType to react-datasheet-grid columns for other types
                let baseColumn = textColumn;

                if (prop.type === 'checkbox') {
                    baseColumn = checkboxColumnCustom({
                        propId: prop.id,
                        onCommit: (rowId, value) => updatePageProperty(databaseId, rowId, prop.id, value)
                    }) as any;
                } else if (prop.type === 'select' || prop.type === 'multi_select') {
                    // Full-row column — no keyColumn wrapping needed.
                    // onCommit calls updatePageProperty directly, bypassing the
                    // setRowData → onChange → updatePageProperty timing race.
                    baseColumn = selectColumn({
                        choices: prop.config?.options || [],
                        propId: prop.id,
                        onCommit: (rowId, value) => updatePageProperty(databaseId, rowId, prop.id, value),
                    }) as any;
                } else if (prop.type === 'date') {
                    baseColumn = dateColumn as any;
                } else if (prop.type === 'created_time' || prop.type === 'last_edited_time') {
                    baseColumn = metaDateColumn as any;
                } else if (prop.type === 'currency' || prop.type === 'number' || prop.type === 'percent') {
                    const symbol = prop.type === 'currency' ? (prop.config?.format === 'dollar' ? '$' : '€') : prop.type === 'percent' ? '%' : '';
                    const isComputed = ['totalExVat', 'totalVat', 'totalIncVat'].includes(prop.id);
                    baseColumn = currencyColumn(prop.id, symbol, isComputed) as any;
                } else if (prop.type === 'variants') {
                    baseColumn = variantsColumn as any;
                }
                // More custom columns like Number will go here later

                // Select/multi_select/checkbox use full row access:
                // they directly call onCommit — no keyColumn needed.
                if (prop.type === 'select' || prop.type === 'multi_select' || prop.type === 'checkbox') {
                    return {
                        ...baseColumn,
                        title: GhostHeader,
                        basis: currentWidth,
                        grow: 0,
                        shrink: 0,
                        minWidth: currentWidth,
                        maxWidth: currentWidth,
                        cellClassName: `dsg-col-${prop.id}`
                    };
                }

                return {
                    ...keyColumn(prop.id, baseColumn),
                    title: GhostHeader,
                    basis: currentWidth,
                    grow: 0,
                    shrink: 0,
                    minWidth: currentWidth,
                    maxWidth: currentWidth,
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
                        <Checkbox
                            checked={rowData._isSelected || false}
                            onChange={(checked) => {
                                const isChecked = checked;
                                setSelectedRowIds(prevSet => {
                                    const next = new Set(prevSet);
                                    if (isChecked) next.add(rowData.id);
                                    else next.delete(rowData.id);
                                    return next;
                                });
                            }}
                            className="w-3.5 h-3.5 rounded border-neutral-300 accent-orange-500 text-orange-600 focus:ring-orange-500 cursor-pointer"
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

                        <DropdownMenuContent align="start" className="w-48 z-[100]">
                            <DropdownMenuItem onClick={() => setActivePageId(rowData.id)} className="cursor-pointer">
                                <Maximize2 className="w-4 h-4 mr-2" />
                                <span>Open</span>
                            </DropdownMenuItem>
                            {!isBestekReadOnly && (
                                <DropdownMenuItem onClick={() => {
                                    const newProps = { ...rowData.properties };
                                    if (newProps.title) {
                                        newProps.title = `${newProps.title} (Copy)`;
                                    }
                                    createPage(databaseIdRef, newProps, undefined, rowData.blocks);
                                }} className="cursor-pointer">
                                    <Copy className="w-4 h-4 mr-2" />
                                    <span>Duplicate</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {/* Delete — blocked if preventDelete says so */}
                            {(() => {
                                const blocked = typeof preventDelete === 'function'
                                    ? preventDelete(rowData)
                                    : !!preventDelete || isBestekReadOnly;
                                if (blocked) return null;
                                return (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            if (window.confirm('Permanently delete this record?')) {
                                                deletePage(databaseIdRef, rowData.id);
                                            }
                                        }}
                                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                    >
                                        <Trash className="w-4 h-4 mr-2" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                );
                            })()}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
            ...mappedProperties
        ]
    }, [databaseIdRef, activeViewId, viewStateMap, orderedVisibleProperties, resizingProperty, resizeOffset, isBestekReadOnly, preventDelete, router, isFree]);
}
