'use client';
/**
 * GRID-REPLACE-1 · the new grid — TanStack Table (headless) + TanStack Virtual, behind a per-database switch.
 * coral-r3-grid.md R3-B: built on the core, the invariant by construction:
 *   "A cell edit commits its own field and nothing else."
 * - ONE click edits a cell (no three-click title); Enter / Tab / blur commit, Escape cancels;
 * - a commit is ONE field: updatePageProperty(db, page, field, value) → the store's sync → the one record door
 *   (R2-1) as an intent for that field. There is NO whole-row diff (the N1 mechanism of the old grid is not ported);
 * - while a cell is edited the rows hold their positions (view-sort holdOrder) — no wrong-row overwrite;
 * - no document-level listeners: nothing leaks into overlays (the old grid needed useOverlayEventShield).
 * Edits: title / text / number / currency / percent / url / email / phone (phase 1), select / multi-select / checkbox /
 * date / relation (phase 2, v2/cells.tsx). Computed on read, never written: rollup (lib/records/rollup), formula
 * (formulaEngine), comments. Variants: a summary (edited in the record).
 * Rules: lib/records/view-sort.ts, grid-cell.ts, view-scope.ts — shared with the old grid, never copied.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Lock, Maximize2, Plus, Trash2, Download } from 'lucide-react';
import PropertiesDropdown from '../components/PropertiesDropdown';
import FilterToolbar from '../components/FilterToolbar';
import SortToolbar from '../components/SortToolbar';
import { useExportCSV } from '../hooks/useExportCSV';
import { toast } from 'sonner';
import { useDatabaseStore } from '../store';
import type { Page, Property } from '../types';
import { useFilteredPages } from '../hooks/useFilteredPages';
import { useOpenLinkedRecord } from '../hooks/useOpenLinkedRecord';
import { LatestCommentCell } from '../columns/CommentsColumn';
import { SelectCell, CheckboxCell, DateCell, RelationCell, RollupCell, FormulaCell } from './cells';
import { collectRollup, applyRollupAggregation, locatorOf } from '@/lib/records/rollup';
import { evaluateFormula } from '../formulaEngine';
import { sortPages, holdOrder } from '@/lib/records/view-sort';
import { visibleColumns } from '@/lib/records/view-scope';
import { isTextEditable, parseCellInput, cellText, cellChanged } from '@/lib/records/grid-cell';
import { resolveRelationTitle } from '@/lib/relations/resolve';

const ROW_H = 36;

interface Props {
    databaseId: string;
    viewId?: string;
    hardFilter?: { propertyId: string; value: string };
    onOpenRecord?: (pageId: string) => void;
    hideFooterNew?: boolean;
}

type Editing = { pageId: string; propId: string; text: string } | null;

export default function NotionGridV2({ databaseId, viewId, hardFilter, onOpenRecord, hideFooterNew }: Props) {
    const database = useDatabaseStore(s => s.databases.find(d => d.id === databaseId));
    const allDatabases = useDatabaseStore(s => s.databases);
    const updatePageProperty = useDatabaseStore(s => s.updatePageProperty);
    const createPage = useDatabaseStore(s => s.createPage);
    const openLinked = useOpenLinkedRecord();
    const activeView = database?.views.find(v => v.id === viewId) || database?.views[0];
    const locate = useMemo(() => locatorOf(allDatabases), [allDatabases]);   // for rollups (lib/records/rollup)

    const [editing, setEditing] = useState<Editing>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const deletePages = useDatabaseStore(s => s.deletePages);
    const frozenIds = useRef<string[] | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Enter / Tab / Escape leave the cell on purpose — the blur that follows the unmount must not commit again
    // (and Escape must not commit at all).
    const leaving = useRef(false);

    const filtered = useFilteredPages({ database, activeView, hardFilter, allDatabases });
    const sorted = useMemo(() => sortPages(filtered, activeView?.sorts ?? [], Date.now()), [filtered, activeView?.sorts]);
    // While a cell is edited, the rows keep their places (an edit never moves the row under the cursor).
    if (editing && !frozenIds.current) frozenIds.current = sorted.map(p => p.id);
    if (!editing) frozenIds.current = null;
    const rows = useMemo(() => holdOrder(frozenIds.current, sorted), [sorted, editing]);   // eslint-disable-line react-hooks/exhaustive-deps

    const columns = useMemo(() => visibleColumns(database?.properties || [], activeView?.propertiesState), [database?.properties, activeView?.propertiesState]);
    const widthOf = useCallback((propId: string) => activeView?.propertiesState?.find(s => s.propertyId === propId)?.width || (propId === 'title' ? 260 : 160), [activeView?.propertiesState]);

    const openRecord = useCallback((pageId: string) => {
        if (onOpenRecord) onOpenRecord(pageId);
        else if (database) openLinked(database, pageId);
    }, [onOpenRecord, openLinked, database]);

    /** ONE field, ONE commit — never the row. */
    const commit = useCallback((e: NonNullable<Editing>) => {
        if (!database) return;
        const prop = database.properties.find(p => p.id === e.propId);
        const page = database.pages.find(p => p.id === e.pageId);
        if (!prop || !page) return;
        const parsed = parseCellInput(prop as never, e.text);
        if (!parsed.ok) { toast.error(`${prop.name}: geen getal`); return; }
        if (!cellChanged(page.properties[prop.id], parsed.value)) return;
        updatePageProperty(database.id, page.id, prop.id, parsed.value as never);
    }, [database, updatePageProperty]);

    /** A control cell's value — ONE field, written only when it changed; an exported document stays as it is. */
    const commitValue = useCallback((page: Page, prop: Property, v: unknown) => {
        if (!database) return;
        if (page.properties.accountantExportedAt === true) { toast.message('Dit document is geëxporteerd naar de boekhouder en kan niet meer gewijzigd worden.'); return; }
        if (!cellChanged(page.properties[prop.id], v)) return;
        updatePageProperty(database.id, page.id, prop.id, v as never);
    }, [database, updatePageProperty]);

    const startEdit = (page: Page, prop: Property) => {
        if (page.properties.accountantExportedAt === true) { toast.message('Dit document is geëxporteerd naar de boekhouder en kan niet meer gewijzigd worden.'); return; }
        setEditing({ pageId: page.id, propId: prop.id, text: cellText(prop as never, page.properties[prop.id]) });
    };

    const moveTo = (fromPage: string, fromProp: string, dRow: number, dCol: number) => {
        const r = rows.findIndex(p => p.id === fromPage) + dRow;
        let c = columns.findIndex(p => p.id === fromProp) + dCol;
        while (c >= 0 && c < columns.length && !isTextEditable(columns[c] as never)) c += dCol || 1;
        const page = rows[r], prop = columns[c];
        if (page && prop && isTextEditable(prop as never)) startEdit(page, prop); else setEditing(null);
    };

    const colDefs = useMemo<ColumnDef<Page>[]>(() => columns.map(prop => ({
        id: prop.id,
        header: () => <span className="truncate">{prop.name}</span>,
        size: widthOf(prop.id),
        cell: ({ row }) => {
            const page = row.original;
            const value = page.properties[prop.id];
            const isEditing = editing?.pageId === page.id && editing.propId === prop.id;
            if (isEditing) {
                return (
                    <input
                        autoFocus
                        value={editing.text}
                        inputMode={prop.type === 'number' ? 'decimal' : undefined}
                        onChange={ev => setEditing({ ...editing, text: ev.target.value })}
                        onBlur={() => { if (leaving.current) { leaving.current = false; return; } commit(editing); setEditing(null); }}
                        onKeyDown={ev => {
                            if (ev.key === 'Escape') { ev.preventDefault(); leaving.current = true; setEditing(null); }
                            else if (ev.key === 'Enter') { ev.preventDefault(); leaving.current = true; commit(editing); moveTo(page.id, prop.id, 1, 0); }
                            else if (ev.key === 'Tab') { ev.preventDefault(); leaving.current = true; commit(editing); moveTo(page.id, prop.id, 0, ev.shiftKey ? -1 : 1); }
                        }}
                        className="w-full h-full px-2 text-sm bg-white dark:bg-neutral-900 outline-none ring-2 ring-inset ring-orange-400"
                    />
                );
            }
            if ((prop.type as string) === 'comments') return <LatestCommentCell pageId={page.id} databaseId={databaseId} onOpen={openRecord} />;
            // GRID-REPLACE-2 · control cells — each commits ONE field through commitValue
            const locked = page.properties.accountantExportedAt === true;
            if (prop.type === 'select' || prop.type === 'multi_select') {
                return <SelectCell value={value} options={prop.config?.options || []} multi={prop.type === 'multi_select'} readOnly={locked} onCommit={v => commitValue(page, prop, v)} />;
            }
            if (prop.type === 'checkbox') return <CheckboxCell value={value} readOnly={locked} onCommit={v => commitValue(page, prop, v)} />;
            if (prop.type === 'date') return <DateCell value={value} readOnly={locked} onCommit={v => commitValue(page, prop, v)} />;
            if (prop.type === 'relation' && prop.config?.relationDatabaseId) {
                return <RelationCell value={value} relationDatabaseId={prop.config.relationDatabaseId} displayPropertyId={prop.config.relationDisplayPropertyId}
                                     readOnly={locked} onCommit={v => commitValue(page, prop, v)} onOpen={(dbId, pid) => openLinked(dbId, pid)} />;
            }
            if (prop.type === 'rollup') {
                const c = prop.config;
                const values = c?.rollupPropertyId && c?.rollupTargetPropertyId
                    ? applyRollupAggregation(collectRollup(page.properties[c.rollupPropertyId], locate, c.rollupTargetPropertyId), c.rollupAggregation)
                    : [];
                return <RollupCell values={values} onOpen={(dbId, pid) => openLinked(dbId, pid)} />;
            }
            if (prop.type === 'formula') {
                const expr = prop.config?.formulaExpression || '';
                return <FormulaCell result={expr ? evaluateFormula(expr, { rowProperties: page.properties, schema: database!.properties }) : null} />;
            }
            if ((prop.type as string) === 'variants') {
                const axes = Array.isArray(value) ? (value as Array<{ name?: string }>) : [];
                return <div className="w-full h-full px-2 flex items-center text-xs text-neutral-500 truncate">{axes.map(a => a.name).filter(Boolean).join(' · ') || '—'}</div>;
            }
            const text = cellText(prop as never, value, id => resolveRelationTitle(id));
            const editable = isTextEditable(prop as never);
            return (
                <div
                    className={`w-full h-full px-2 flex items-center gap-1 text-sm truncate ${editable ? 'cursor-text' : 'text-neutral-600 dark:text-neutral-400'}`}
                    onClick={() => { if (editable) startEdit(page, prop); }}
                >
                    <span className={`truncate ${prop.id === 'title' ? 'font-medium' : ''}`}>{text}</span>
                    {prop.id === 'title' && (
                        <button type="button" title="Openen" onClick={ev => { ev.stopPropagation(); openRecord(page.id); }}
                                className="ml-auto shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500">
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {prop.id === 'title' && page.properties.accountantExportedAt === true && <Lock className="w-3 h-3 text-neutral-400 shrink-0" />}
                </div>
            );
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [columns, editing, widthOf, commit, commitValue, openRecord, databaseId, rows, locate, openLinked, database]);

    const table = useReactTable({ data: rows, columns: colDefs, getCoreRowModel: getCoreRowModel(), getRowId: r => r.id });
    const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_H, overscan: 12 });
    const totalWidth = columns.reduce((w, p) => w + widthOf(p.id), 48);

    const exportCsv = useExportCSV({ database, filteredPages: rows, selectedRowIds: selected });
    if (!database) return null;
    const tableRows = table.getRowModel().rows;
    const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
    const toggleRow = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const deleteSelected = () => {
        const ids = [...selected].filter(id => rows.some(r => r.id === id));
        if (!ids.length) return;
        if (!window.confirm(`${ids.length} record(s) definitief verwijderen?`)) return;
        // the door refuses an issued document (sent invoice, sent quote, exported record) — the store puts it back and says why
        deletePages(database.id, ids);
        setSelected(new Set());
    };

    return (
        <div className="flex flex-col h-full min-h-0 border border-neutral-200 dark:border-white/10 rounded-b-xl overflow-hidden bg-white dark:bg-black">
            {/* Toolbar — the same components as the old grid (no copies); DB-HEADER-1 moves them into the one header. */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-neutral-200 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Raster V2</span>
                {selected.size > 0 && (
                    <>
                        <span className="text-xs text-neutral-500">{selected.size} geselecteerd</span>
                        <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 className="w-3.5 h-3.5" /> Verwijderen</button>
                        <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-neutral-500 hover:underline">Wissen</button>
                    </>
                )}
                <div className="ml-auto flex items-center gap-1">
                    {activeView && <PropertiesDropdown databaseId={database.id} viewId={activeView.id} />}
                    {activeView && <FilterToolbar databaseId={database.id} viewId={activeView.id} />}
                    {activeView && <SortToolbar databaseId={database.id} viewId={activeView.id} />}
                    <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                </div>
            </div>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
                <div style={{ width: totalWidth, minWidth: '100%' }}>
                    {/* header */}
                    <div className="sticky top-0 z-10 flex bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 text-xs font-semibold text-neutral-500">
                        <div className="w-12 shrink-0 flex items-center justify-center">
                            <input type="checkbox" aria-label="Alles selecteren" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))} className="w-3.5 h-3.5 accent-orange-500" />
                        </div>
                        {table.getHeaderGroups()[0]?.headers.map(h => (
                            <div key={h.id} style={{ width: widthOf(h.id) }} className="shrink-0 h-9 px-2 flex items-center border-r border-neutral-200 dark:border-white/5">
                                {flexRender(h.column.columnDef.header, h.getContext())}
                            </div>
                        ))}
                    </div>
                    {/* rows — only the visible ones are rendered */}
                    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                        {virtualizer.getVirtualItems().map(v => {
                            const row = tableRows[v.index];
                            if (!row) return null;
                            return (
                                <div key={row.id} data-page-id={row.id} className="group absolute left-0 flex border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50/60 dark:hover:bg-white/[0.02]"
                                     style={{ top: v.start, height: ROW_H, width: totalWidth, minWidth: '100%' }}>
                                    <div className="w-12 shrink-0 flex items-center justify-center text-[11px] text-neutral-400">
                                        <span className={selected.has(row.id) ? 'hidden' : 'group-hover:hidden'}>{v.index + 1}</span>
                                        <input type="checkbox" aria-label="Selecteren" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)}
                                               className={`w-3.5 h-3.5 accent-orange-500 ${selected.has(row.id) ? '' : 'hidden group-hover:block'}`} />
                                    </div>
                                    {row.getVisibleCells().map(cell => (
                                        <div key={cell.id} style={{ width: widthOf(cell.column.id) }} className="shrink-0 h-full border-r border-neutral-100 dark:border-white/5 overflow-hidden">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {!hideFooterNew && (
                <button type="button"
                        onClick={() => {
                            const page = createPage(database.id, hardFilter ? { [hardFilter.propertyId]: hardFilter.value } : {});
                            const title = database.properties.find(p => p.id === 'title');
                            if (page && title) setEditing({ pageId: page.id, propId: 'title', text: '' });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 border-t border-neutral-200 dark:border-white/10">
                    <Plus className="w-3.5 h-3.5" /> Nieuw
                </button>
            )}
        </div>
    );
}
