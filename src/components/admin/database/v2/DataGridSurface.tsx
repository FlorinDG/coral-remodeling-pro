'use client';
/**
 * GRID-SURFACE-1 · Presentational Data Grid Surface
 *
 * Headless TanStack Table + TanStack Virtual grid shell extracted from NotionGridV2.
 * Strictly presentational:
 * - Columns, rows, cell renderers, sorting, virtualization
 * - Column resize with pointer capture, column drag-and-drop reorder
 * - Selection toggle column, row leading action slot
 * - Keyboard navigation and clipboard event hooks
 * - Header tabs slot, bottom footer slot
 * - NO store imports (no useDatabaseStore, no Page, no Property)
 */
import React, { useRef, useState, useEffect } from 'react';
import { useReactTable, getCoreRowModel, type ColumnDef, type CellContext, type HeaderContext } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

const DEFAULT_ROW_H = 36;

export interface DataGridSurfaceProps<TRow> {
    data: TRow[];
    columns: ColumnDef<TRow>[];
    getRowId?: (row: TRow) => string;
    rowHeight?: number;
    wrap?: boolean;

    // Width & order
    columnIds?: string[];
    widthOf?: (columnId: string) => number;
    onColumnMove?: (sourceColId: string, targetColId: string) => void;
    onColumnResize?: (colId: string, width: number) => void;
    onColumnResizeReset?: (colId: string) => void;

    // Selection
    selected?: Set<string>;
    onToggleRow?: (id: string) => void;
    onSelectAll?: (selectAll: boolean) => void;
    allSelected?: boolean;
    showSelectionColumn?: boolean;

    // Active cell / keyboard
    active?: { rowId: string; colId: string } | null;
    onActiveChange?: (active: { rowId: string; colId: string } | null) => void;
    scrollRef?: React.RefObject<HTMLDivElement | null>;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onCopy?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
    onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;

    // Row rendering & events
    renderRowLeading?: (row: TRow, index: number) => React.ReactNode;
    onRowClick?: (row: TRow) => void;

    // Slots
    renderTabs?: React.ReactNode;
    renderFooter?: React.ReactNode;
    emptyMessage?: React.ReactNode;
    className?: string;
}

export default function DataGridSurface<TRow>({
    data,
    columns,
    getRowId,
    rowHeight = DEFAULT_ROW_H,
    wrap = false,
    columnIds,
    widthOf: propWidthOf,
    onColumnMove,
    onColumnResize,
    onColumnResizeReset,
    selected,
    onToggleRow,
    onSelectAll,
    allSelected = false,
    showSelectionColumn = false,
    active,
    onActiveChange,
    scrollRef: propScrollRef,
    onKeyDown,
    onCopy,
    onPaste,
    renderRowLeading,
    onRowClick,
    renderTabs,
    renderFooter,
    emptyMessage,
    className = '',
}: DataGridSurfaceProps<TRow>) {
    const internalScrollRef = useRef<HTMLDivElement>(null);
    const scrollRef = propScrollRef || internalScrollRef;

    const [liveWidth, setLiveWidth] = useState<{ id: string; w: number } | null>(null);
    const [dragCol, setDragCol] = useState<string | null>(null);
    const [dropCol, setDropCol] = useState<string | null>(null);
    const resizing = useRef(false);

    const cols = columnIds || columns.map(c => (c.id as string) || '');
    const widthOf = (colId: string): number => {
        if (liveWidth?.id === colId) return liveWidth.w;
        if (propWidthOf) return propWidthOf(colId);
        const colDef = columns.find(c => c.id === colId);
        return (typeof colDef?.size === 'number' ? colDef.size : 160);
    };

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: getRowId || ((_, idx) => String(idx)),
    });

    const virtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => rowHeight,
        overscan: 12,
    });

    useEffect(() => {
        virtualizer.measure();
    }, [wrap, virtualizer]);

    const leadingWidth = showSelectionColumn ? 48 : 0;
    const totalWidth = cols.reduce((w, id) => w + widthOf(id), leadingWidth);
    const tableRows = table.getRowModel().rows;

    return (
        <div className={`flex flex-col h-full min-h-0 border border-neutral-200 dark:border-white/10 rounded-b-xl overflow-hidden bg-white dark:bg-black ${className}`}>
            {renderTabs && (
                <div className="px-3 pt-2.5 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end relative z-[60]">
                    <div className="flex items-end pr-2 min-w-0 overflow-x-auto no-scrollbar">{renderTabs}</div>
                </div>
            )}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-auto outline-none"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onCopy={onCopy}
                onPaste={onPaste}
            >
                <div style={{ width: totalWidth, minWidth: '100%' }}>
                    {/* header */}
                    <div className="sticky top-0 z-10 flex bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 text-xs font-semibold text-neutral-500">
                        {showSelectionColumn && (
                            <div className="w-12 shrink-0 flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    aria-label="Select all"
                                    checked={allSelected}
                                    onChange={(e) => onSelectAll?.(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-orange-500"
                                />
                            </div>
                        )}
                        {table.getHeaderGroups()[0]?.headers.map(h => (
                            <div
                                key={h.id}
                                style={{ width: widthOf(h.id) }}
                                draggable={Boolean(onColumnMove)}
                                onDragStart={e => {
                                    if (resizing.current || !onColumnMove) { e.preventDefault(); return; }
                                    setDragCol(h.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={e => {
                                    if (dragCol && dragCol !== h.id && onColumnMove) {
                                        e.preventDefault();
                                        if (dropCol !== h.id) setDropCol(h.id);
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dropCol === h.id) setDropCol(null);
                                }}
                                onDrop={e => {
                                    e.preventDefault();
                                    if (dragCol && onColumnMove) onColumnMove(dragCol, h.id);
                                    setDragCol(null);
                                    setDropCol(null);
                                }}
                                onDragEnd={() => {
                                    setDragCol(null);
                                    setDropCol(null);
                                }}
                                className={`relative shrink-0 h-9 px-2 flex items-center border-r border-neutral-200 dark:border-white/5 ${onColumnMove ? 'cursor-grab' : ''} select-none ${dragCol === h.id ? 'opacity-40' : ''} ${dragCol && dropCol === h.id ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}
                            >
                                {dragCol && dropCol === h.id && onColumnMove && (
                                    <span
                                        aria-hidden
                                        className={`absolute top-0 bottom-0 w-0.5 bg-orange-500 ${cols.indexOf(dragCol) < cols.indexOf(h.id) ? 'right-0' : 'left-0'}`}
                                    />
                                )}
                                {(h.column.columnDef.header as (c: HeaderContext<TRow, unknown>) => React.ReactNode)(h.getContext())}
                                {Boolean(onColumnResize) && (
                                    <div
                                        title="Column width"
                                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-orange-400/60"
                                        draggable={false}
                                        onDragStart={e => e.preventDefault()}
                                        onPointerDown={e => {
                                            e.stopPropagation();
                                            const el = e.currentTarget;
                                            resizing.current = true;
                                            el.setPointerCapture(e.pointerId);
                                            el.dataset.x = String(e.clientX);
                                            el.dataset.w = String(widthOf(h.id));
                                            setLiveWidth({ id: h.id, w: widthOf(h.id) });
                                        }}
                                        onPointerMove={e => {
                                            const el = e.currentTarget;
                                            if (!el.hasPointerCapture(e.pointerId)) return;
                                            setLiveWidth({
                                                id: h.id,
                                                w: Math.max(60, Number(el.dataset.w) + e.clientX - Number(el.dataset.x)),
                                            });
                                        }}
                                        onPointerUp={e => {
                                            const el = e.currentTarget;
                                            resizing.current = false;
                                            if (!el.hasPointerCapture(e.pointerId)) return;
                                            el.releasePointerCapture(e.pointerId);
                                            const w = Number(el.dataset.w) + e.clientX - Number(el.dataset.x);
                                            setLiveWidth(null);
                                            onColumnResize?.(h.id, w);
                                        }}
                                        onPointerCancel={() => {
                                            resizing.current = false;
                                            setLiveWidth(null);
                                        }}
                                        onDoubleClick={e => {
                                            e.stopPropagation();
                                            onColumnResizeReset?.(h.id);
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* rows */}
                    {data.length === 0 ? (
                        emptyMessage ? (
                            <div className="p-8 text-center text-sm text-neutral-400">{emptyMessage}</div>
                        ) : null
                    ) : (
                        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                            {virtualizer.getVirtualItems().map(v => {
                                const row = tableRows[v.index];
                                if (!row) return null;
                                const rowId = row.id;

                                return (
                                    <div
                                        key={rowId}
                                        data-row-id={rowId}
                                        data-index={v.index}
                                        ref={wrap ? virtualizer.measureElement : undefined}
                                        onClick={() => onRowClick?.(row.original)}
                                        className="group absolute left-0 flex border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50/60 dark:hover:bg-white/[0.02]"
                                        style={{
                                            top: v.start,
                                            height: wrap ? undefined : rowHeight,
                                            minHeight: rowHeight,
                                            width: totalWidth,
                                            minWidth: '100%',
                                        }}
                                    >
                                        {showSelectionColumn && (
                                            <div className="w-12 shrink-0 flex items-center justify-center text-[11px] text-neutral-400">
                                                {renderRowLeading ? (
                                                    renderRowLeading(row.original, v.index)
                                                ) : (
                                                    <>
                                                        <span className={selected?.has(rowId) ? 'hidden' : 'group-hover:hidden'}>
                                                            {v.index + 1}
                                                        </span>
                                                        <input
                                                            type="checkbox"
                                                            aria-label="Select row"
                                                            checked={selected?.has(rowId) ?? false}
                                                            onChange={() => onToggleRow?.(rowId)}
                                                            className={`w-3.5 h-3.5 accent-orange-500 ${selected?.has(rowId) ? '' : 'hidden group-hover:block'}`}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {row.getVisibleCells().map(cell => (
                                            <div
                                                key={cell.id}
                                                style={{ width: widthOf(cell.column.id) }}
                                                onMouseDown={() => onActiveChange?.({ rowId, colId: cell.column.id })}
                                                className={`shrink-0 ${wrap ? '' : 'h-full'} border-r border-neutral-100 dark:border-white/5 overflow-hidden ${active?.rowId === rowId && active.colId === cell.column.id ? 'ring-2 ring-inset ring-orange-300' : ''}`}
                                            >
                                                {(cell.column.columnDef.cell as (c: CellContext<TRow, unknown>) => React.ReactNode)(cell.getContext())}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* footer */}
            {renderFooter}
        </div>
    );
}
