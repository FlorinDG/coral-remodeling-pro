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
import { Lock, Maximize2, Plus, Trash2, Download, Upload, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SpreadsheetImportModal } from '../components/SpreadsheetImportModal';
import { AccountantExportDialog } from '../components/AccountantExportDialog';
import { canRunAccountantExport } from '@/lib/roles';
import { ACCOUNTANT_EXPORT_SOURCES } from '@/lib/kernel/system-databases';
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
import { visibleColumns, moveColumn, setColumnWidth } from '@/lib/records/view-scope';
import { isTextEditable, parseCellInput, cellText, cellChanged, parseClipboardGrid, pasteValue } from '@/lib/records/grid-cell';
import { resolveRelationTitle } from '@/lib/relations/resolve';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { gridAccess, bulkApproveCheck, licensedColumns, EXPENSES_INBOX_VIEW, REVIEW_READY, REVIEW_APPROVED } from '@/lib/records/grid-access';
import { VAT_FIELD, VAT_LOOKUP_ROLES } from '@/lib/records/vat-lookup';
import { VatLookupFlyout } from './cells';

const ROW_H = 36;

interface Props {
    databaseId: string;
    viewId?: string;
    hardFilter?: { propertyId: string; value: string };
    onOpenRecord?: (pageId: string) => void;
    hideFooterNew?: boolean;
    /** A screen's own row guard (invoices: only drafts may be deleted) — same as the old grid's prop. */
    preventDelete?: boolean | ((row: Page) => boolean);
    /** A system database's fields are the kernel's — no CSV import of new columns (same as the old grid). */
    lockedSchema?: boolean;
}

type Editing = { pageId: string; propId: string; text: string } | null;

export default function NotionGridV2({ databaseId, viewId, hardFilter, onOpenRecord, hideFooterNew, preventDelete, lockedSchema }: Props) {
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

    const { activeModules } = useTenant();
    const hasCRM = (activeModules || []).includes('CRM');
    const columns = useMemo(() => licensedColumns(visibleColumns(database?.properties || [], activeView?.propertiesState), { logicalKey: database?.logicalKey, hasCRM }), [database?.properties, database?.logicalKey, activeView?.propertiesState, hasCRM]);
    const [importOpen, setImportOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    // Column width: the view's, or the live one while the handle is dragged (pointer capture — no document listeners).
    const [liveWidth, setLiveWidth] = useState<{ id: string; w: number } | null>(null);
    const widthOf = useCallback((propId: string) => (liveWidth?.id === propId ? liveWidth.w : undefined)
        ?? activeView?.propertiesState?.find(s => s.propertyId === propId)?.width ?? (propId === 'title' ? 260 : 160), [activeView?.propertiesState, liveWidth]);
    const updateView = useDatabaseStore(s => s.updateView);
    const saveColumns = useCallback((next: NonNullable<typeof activeView>['propertiesState']) => {
        if (database && activeView) updateView(database.id, activeView.id, { propertiesState: next });   // → DB-DEF-1 view op
    }, [database, activeView, updateView]);
    const [dragCol, setDragCol] = useState<string | null>(null);
    // Keyboard: the active cell (arrows move it; Enter or typing edits a text cell).
    const [active, setActive] = useState<{ pageId: string; propId: string } | null>(null);

    // Who may change records here — the ONE rule (lib/records/grid-access): the accountant reads; the bestek is
    // read-only below ENTERPRISE. A screen's own row guard (preventDelete) applies on top.
    const { data: session } = useSession();
    const { isEnterprise } = useTenant();
    const tAdmin = useTranslations('Admin');
    const access = gridAccess({ userRole: (session?.user as { role?: string } | undefined)?.role, logicalKey: database?.logicalKey, isEnterprise });
    const editingInput = useRef<HTMLInputElement | null>(null);

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
        if (!database || !access.edit) return;
        if (page.properties.accountantExportedAt === true) { toast.message('Dit document is geëxporteerd naar de boekhouder en kan niet meer gewijzigd worden.'); return; }
        if (!cellChanged(page.properties[prop.id], v)) return;
        updatePageProperty(database.id, page.id, prop.id, v as never);
    }, [database, updatePageProperty, access.edit]);

    const startEdit = (page: Page, prop: Property) => {
        if (!access.edit) return;
        if (page.properties.accountantExportedAt === true) { toast.message('Dit document is geëxporteerd naar de boekhouder en kan niet meer gewijzigd worden.'); return; }
        setActive({ pageId: page.id, propId: prop.id });
        setEditing({ pageId: page.id, propId: prop.id, text: cellText(prop as never, page.properties[prop.id]) });
    };

    const moveTo = (fromPage: string, fromProp: string, dRow: number, dCol: number) => {
        const r = rows.findIndex(p => p.id === fromPage) + dRow;
        let c = columns.findIndex(p => p.id === fromProp) + dCol;
        while (c >= 0 && c < columns.length && !isTextEditable(columns[c] as never)) c += dCol || 1;
        const page = rows[r], prop = columns[c];
        if (page && prop && isTextEditable(prop as never)) startEdit(page, prop);
        else { setEditing(null); requestAnimationFrame(() => scrollRef.current?.focus()); }   // keyboard stays in the grid
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
                    <>
                    <input
                        autoFocus
                        value={editing.text}
                        inputMode={prop.type === 'number' ? 'decimal' : undefined}
                        onChange={ev => setEditing({ ...editing, text: ev.target.value })}
                        onBlur={() => { if (leaving.current) { leaving.current = false; return; } commit(editing); setEditing(null); }}
                        onKeyDown={ev => {
                            if (ev.key === 'Escape') { ev.preventDefault(); leaving.current = true; setEditing(null); requestAnimationFrame(() => scrollRef.current?.focus()); }
                            else if (ev.key === 'Enter') { ev.preventDefault(); leaving.current = true; commit(editing); moveTo(page.id, prop.id, 1, 0); }
                            else if (ev.key === 'Tab') { ev.preventDefault(); leaving.current = true; commit(editing); moveTo(page.id, prop.id, 0, ev.shiftKey ? -1 : 1); }
                        }}
                        ref={el => { editingInput.current = el; }}
                        className="w-full h-full px-2 text-sm bg-white dark:bg-neutral-900 outline-none ring-2 ring-inset ring-orange-400"
                    />
                    {/* VAT lookup — the kernel's 'vat' field on contacts / suppliers (lib/records/vat-lookup) */}
                    {prop.id === VAT_FIELD && VAT_LOOKUP_ROLES.has(database?.logicalKey || '') && (
                        <VatLookupFlyout text={editing.text} anchor={editingInput} fieldIds={database!.properties.map(p => p.id)}
                                         onApply={patch => { const p = database!.pages.find(x => x.id === page.id); if (p) for (const [k, v] of Object.entries(patch)) commitValue(p, { id: k } as Property, v); }} />
                    )}
                    </>
                );
            }
            if ((prop.type as string) === 'comments') return <LatestCommentCell pageId={page.id} databaseId={databaseId} onOpen={openRecord} />;
            // GRID-REPLACE-2 · control cells — each commits ONE field through commitValue
            const locked = page.properties.accountantExportedAt === true || !access.edit;
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
    })), [columns, editing, widthOf, commit, commitValue, openRecord, databaseId, rows, locate, openLinked, database, access.edit]);

    const table = useReactTable({ data: rows, columns: colDefs, getCoreRowModel: getCoreRowModel(), getRowId: r => r.id });
    const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_H, overscan: 12 });
    const totalWidth = columns.reduce((w, p) => w + widthOf(p.id), 48);

    const exportCsv = useExportCSV({ database, filteredPages: rows, selectedRowIds: selected });
    if (!database) return null;
    const tableRows = table.getRowModel().rows;
    const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
    const toggleRow = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const deleteSelected = () => {
        if (!access.delete || preventDelete === true) return;
        // a screen's own row guard (e.g. invoices: draft only) — the rest is refused by the door anyway
        const ids = [...selected].filter(id => { const r = rows.find(x => x.id === id); return r && !(typeof preventDelete === 'function' && preventDelete(r)); });
        if (!ids.length) { toast.message('Geen van de geselecteerde records kan verwijderd worden (enkel concepten).'); return; }
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
                        {access.delete && preventDelete !== true && (
                            <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 className="w-3.5 h-3.5" /> Verwijderen</button>
                        )}
                        <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-neutral-500 hover:underline">Wissen</button>
                    </>
                )}
                {/* the purchase-invoice inbox: approve the selected records the reading marked "Klaar" — one field each */}
                {selected.size > 0 && access.edit && database.logicalKey === 'expenses' && activeView?.id === EXPENSES_INBOX_VIEW && (
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                            onClick={() => {
                                const chk = bulkApproveCheck(rows.filter(r => selected.has(r.id)));
                                if (!chk.ok) { toast.message(`Alleen records die "${REVIEW_READY}" zijn kunnen samen goedgekeurd worden (${chk.notReady.length} nog niet).`); return; }
                                if (!window.confirm(`${chk.ids.length} record(s) goedkeuren?`)) return;
                                for (const id of chk.ids) updatePageProperty(database.id, id, 'reviewStatus', REVIEW_APPROVED);
                                setSelected(new Set());
                            }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Goedkeuren
                    </button>
                )}
                <div className="ml-auto flex items-center gap-1">
                    {canRunAccountantExport((session?.user as { role?: string } | undefined)?.role, !!(session?.user as { isImpersonating?: boolean } | undefined)?.isImpersonating)
                        && ACCOUNTANT_EXPORT_SOURCES.includes(database.logicalKey as never) && (
                        <button type="button" onClick={() => setExportOpen(true)} className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded">
                            📦 {tAdmin('accountant_export_button')}
                        </button>
                    )}
                    {access.create && !lockedSchema && (
                        <button type="button" onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded">
                            <Upload className="w-3.5 h-3.5" /> Import
                        </button>
                    )}
                    {activeView && <PropertiesDropdown databaseId={database.id} viewId={activeView.id} />}
                    {activeView && <FilterToolbar databaseId={database.id} viewId={activeView.id} />}
                    {activeView && <SortToolbar databaseId={database.id} viewId={activeView.id} />}
                    <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                </div>
            </div>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto outline-none" tabIndex={0}
                 onCopy={e => {
                     if (editing) return;
                     const titleOf = (id: string) => resolveRelationTitle(id);
                     let text = '';
                     if (selected.size > 0) {
                         text = rows.filter(p => selected.has(p.id))
                             .map(p => columns.map(c => cellText(c as never, p.properties[c.id], titleOf).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
                     } else if (active) {
                         const p = rows.find(x => x.id === active.pageId), c = columns.find(x => x.id === active.propId);
                         if (p && c) text = cellText(c as never, p.properties[c.id], titleOf);
                     }
                     if (!text) return;
                     e.preventDefault();
                     e.clipboardData.setData('text/plain', text);
                 }}
                 onPaste={e => {
                     if (editing || !active || !database) return;
                     e.preventDefault();
                     if (!access.edit) { toast.message('Alleen-lezen: hier kan niets geplakt worden.'); return; }
                     const block = parseClipboardGrid(e.clipboardData.getData('text/plain'));
                     const r0 = rows.findIndex(p => p.id === active.pageId), c0 = columns.findIndex(p => p.id === active.propId);
                     let written = 0;
                     const skipped: string[] = [];
                     block.forEach((line, i) => line.forEach((txt, j) => {
                         const page = rows[r0 + i], prop = columns[c0 + j];
                         if (!page || !prop) { skipped.push('buiten het raster'); return; }
                         if (page.properties.accountantExportedAt === true) { skipped.push('geëxporteerd'); return; }
                         const v = pasteValue(prop as never, txt);
                         if (!v.ok) { skipped.push(`${prop.name}: ${v.reason}`); return; }
                         if (!cellChanged(page.properties[prop.id], v.value)) return;
                         updatePageProperty(database.id, page.id, prop.id, v.value as never);   // ONE field per cell
                         written++;
                     }));
                     if (skipped.length) toast.message(`${written} cel(len) geplakt · ${skipped.length} overgeslagen (${Array.from(new Set(skipped)).slice(0, 3).join('; ')})`);
                     else if (written) toast.success(`${written} cel(len) geplakt`);
                 }}
                 onKeyDown={e => {
                     if (editing || !active) return;
                     const r = rows.findIndex(p => p.id === active.pageId), c = columns.findIndex(p => p.id === active.propId);
                     const go = (dr: number, dc: number) => {
                         const nr = Math.max(0, Math.min(rows.length - 1, r + dr)), nc = Math.max(0, Math.min(columns.length - 1, c + dc));
                         if (rows[nr] && columns[nc]) { setActive({ pageId: rows[nr].id, propId: columns[nc].id }); virtualizer.scrollToIndex(nr); }
                     };
                     if (e.key === 'ArrowDown') { e.preventDefault(); go(1, 0); }
                     else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1, 0); }
                     else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); go(0, 1); }
                     else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); go(0, -1); }
                     else if (e.key === 'Escape') setActive(null);
                     else {
                         const page = rows[r], prop = columns[c];
                         if (!page || !prop || !isTextEditable(prop as never)) return;
                         if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(page, prop); }
                         else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && access.edit && page.properties.accountantExportedAt !== true) {
                             e.preventDefault(); setEditing({ pageId: page.id, propId: prop.id, text: e.key });   // typing replaces, like a spreadsheet
                         }
                     }
                 }}>
                <div style={{ width: totalWidth, minWidth: '100%' }}>
                    {/* header */}
                    <div className="sticky top-0 z-10 flex bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 text-xs font-semibold text-neutral-500">
                        <div className="w-12 shrink-0 flex items-center justify-center">
                            <input type="checkbox" aria-label="Alles selecteren" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))} className="w-3.5 h-3.5 accent-orange-500" />
                        </div>
                        {table.getHeaderGroups()[0]?.headers.map(h => (
                            <div key={h.id} style={{ width: widthOf(h.id) }}
                                 draggable
                                 onDragStart={e => { setDragCol(h.id); e.dataTransfer.effectAllowed = 'move'; }}
                                 onDragOver={e => { if (dragCol && dragCol !== h.id) e.preventDefault(); }}
                                 onDrop={e => { e.preventDefault(); if (dragCol) saveColumns(moveColumn(activeView?.propertiesState, columns.map(c => c.id), dragCol, h.id)); setDragCol(null); }}
                                 onDragEnd={() => setDragCol(null)}
                                 className={`relative shrink-0 h-9 px-2 flex items-center border-r border-neutral-200 dark:border-white/5 cursor-grab select-none ${dragCol === h.id ? 'opacity-40' : ''}`}>
                                {flexRender(h.column.columnDef.header, h.getContext())}
                                <div
                                    title="Breedte"
                                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-orange-400/60"
                                    draggable={false}
                                    onDragStart={e => e.preventDefault()}
                                    onPointerDown={e => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setLiveWidth({ id: h.id, w: widthOf(h.id) }); (e.target as HTMLElement).dataset.x = String(e.clientX); (e.target as HTMLElement).dataset.w = String(widthOf(h.id)); }}
                                    onPointerMove={e => { const el = e.target as HTMLElement; if (!el.hasPointerCapture(e.pointerId)) return; setLiveWidth({ id: h.id, w: Math.max(60, Number(el.dataset.w) + e.clientX - Number(el.dataset.x)) }); }}
                                    onPointerUp={e => { const el = e.target as HTMLElement; if (!el.hasPointerCapture(e.pointerId)) return; el.releasePointerCapture(e.pointerId); const w = Number(el.dataset.w) + e.clientX - Number(el.dataset.x); setLiveWidth(null); saveColumns(setColumnWidth(activeView?.propertiesState, h.id, w)); }}
                                />
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
                                        <div key={cell.id} style={{ width: widthOf(cell.column.id) }}
                                             onMouseDown={() => setActive({ pageId: row.id, propId: cell.column.id })}
                                             className={`shrink-0 h-full border-r border-neutral-100 dark:border-white/5 overflow-hidden ${active?.pageId === row.id && active.propId === cell.column.id && !editing ? 'ring-2 ring-inset ring-orange-300' : ''}`}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <SpreadsheetImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} databaseId={database.id} />
            <AccountantExportDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} />
            {!hideFooterNew && access.create && (
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
