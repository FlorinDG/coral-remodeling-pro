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
import type { ColumnDef, CellContext, HeaderContext } from '@tanstack/react-table';
import DataGridSurface from './DataGridSurface';
import { Lock, Maximize2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useDatabaseStore } from '../store';
import type { Page, Property } from '../types';
import { useFilteredPages } from '../hooks/useFilteredPages';
import { useOpenLinkedRecord } from '../hooks/useOpenLinkedRecord';
import { LatestCommentCell } from '../components/LatestCommentCell';
import { SelectCell, CheckboxCell, DateCell, RelationCell, RollupCell, FormulaCell } from './cells';
import { collectRollup, applyRollupAggregation, locatorOf } from '@/lib/records/rollup';
import { evaluateFormula } from '../formulaEngine';
import { sortPages, holdOrder } from '@/lib/records/view-sort';
import { visibleColumns, moveColumn, setColumnWidth } from '@/lib/records/view-scope';
import { isTextEditable, parseCellInput, cellText, cellDisplay, NUMERIC_TYPES, cellChanged, parseClipboardGrid, pasteValue } from '@/lib/records/grid-cell';
import { resolveRelationTitle } from '@/lib/relations/resolve';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { duplicateProperties, gridAccess, licensedColumns } from '@/lib/records/grid-access';
import { approvalPlan, REVIEW_APPROVED } from '@/lib/records/validation';
import { VAT_FIELD, VAT_LOOKUP_ROLES } from '@/lib/records/vat-lookup';
import { VatLookupFlyout, RowMenu } from './cells';

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
    /** The screen's header — view tabs, schema link, the V2 switch (DatabaseClone) — same slot as the old grid's. */
    renderTabs?: React.ReactNode;
    /** Hide toolbar when managed externally by DatabaseHeader */
    hideToolbar?: boolean;
    /** Shared selection lifted to DatabaseClone (C7) */
    selected?: Set<string>;
    onSelectedChange?: (selected: Set<string>) => void;
    /** Precomputed sorted pages from DatabaseClone (C8) */
    sortedPages?: Page[];
    /** VALIDATE-1: on the "Te valideren" screen the selection can be approved (lib/records/validation approvalPlan). */
    validationScreen?: 'validated' | 'to-validate';
}

type Editing = { pageId: string; propId: string; text: string } | null;

export default function NotionGridV2({ databaseId, viewId, hardFilter, onOpenRecord, hideFooterNew, preventDelete, lockedSchema, renderTabs, hideToolbar, selected: propSelected, onSelectedChange, sortedPages: propSortedPages, validationScreen }: Props) {
    const database = useDatabaseStore(s => s.databases.find(d => d.id === databaseId));
    const allDatabases = useDatabaseStore(s => s.databases);
    const updatePageProperty = useDatabaseStore(s => s.updatePageProperty);
    const createPage = useDatabaseStore(s => s.createPage);
    const openLinked = useOpenLinkedRecord();
    const activeView = database?.views.find(v => v.id === viewId) || database?.views[0];
    const locate = useMemo(() => locatorOf(allDatabases), [allDatabases]);   // for rollups (lib/records/rollup)

    const [editing, setEditing] = useState<Editing>(null);
    const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
    const selected = propSelected ?? localSelected;
    const setSelected = useCallback((next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
        if (typeof next === 'function') {
            const updated = next(selected);
            if (onSelectedChange) onSelectedChange(updated);
            else setLocalSelected(updated);
        } else {
            if (onSelectedChange) onSelectedChange(next);
            else setLocalSelected(next);
        }
    }, [selected, onSelectedChange]);

    const deletePages = useDatabaseStore(s => s.deletePages);
    const frozenIds = useRef<string[] | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Enter / Tab / Escape leave the cell on purpose — the blur that follows the unmount must not commit again
    // (and Escape must not commit at all).
    const leaving = useRef(false);

    const filtered = useFilteredPages({ database: propSortedPages ? undefined : database, activeView, hardFilter, allDatabases });
    const localSorted = useMemo(() => sortPages(filtered, activeView?.sorts ?? [], Date.now()), [filtered, activeView?.sorts]);
    const sorted = propSortedPages ?? localSorted;
    // While a cell is edited, the rows keep their places (an edit never moves the row under the cursor).
    if (editing && !frozenIds.current) frozenIds.current = sorted.map(p => p.id);
    if (!editing) frozenIds.current = null;
    const rows = useMemo(() => holdOrder(frozenIds.current, sorted), [sorted, editing]);   // eslint-disable-line react-hooks/exhaustive-deps

    const { activeModules } = useTenant();
    const hasCRM = (activeModules || []).includes('CRM');
    const columns = useMemo(() => licensedColumns(visibleColumns(database?.properties || [], activeView?.propertiesState), { logicalKey: database?.logicalKey, hasCRM }), [database?.properties, database?.logicalKey, activeView?.propertiesState, hasCRM]);
    // Column width: the view's, or the live one while the handle is dragged (pointer capture — no document listeners).
    const [liveWidth, setLiveWidth] = useState<{ id: string; w: number } | null>(null);
    const widthOf = useCallback((propId: string) => (liveWidth?.id === propId ? liveWidth.w : undefined)
        ?? activeView?.propertiesState?.find(s => s.propertyId === propId)?.width ?? (propId === 'title' ? 260 : 160), [activeView?.propertiesState, liveWidth]);
    const updateView = useDatabaseStore(s => s.updateView);
    const saveColumns = useCallback((next: NonNullable<typeof activeView>['propertiesState']) => {
        if (database && activeView) updateView(database.id, activeView.id, { propertiesState: next });   // → DB-DEF-1 view op
    }, [database, activeView, updateView]);
    const [dragCol, setDragCol] = useState<string | null>(null);
    const [dropCol, setDropCol] = useState<string | null>(null);
    // The resize handle sits inside the draggable header: while it is held, the header's drag is refused (the column
    // drag used to start instead and cancel the pointer — resize never worked).
    const resizing = useRef(false);
    // Text wrap — the VIEW decides (Florin 2026-10-05): rows grow with their text; otherwise one line, truncated.
    const wrap = activeView?.wrapText === true;
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
        if (!parsed.ok) { toast.error(`${prop.name}: ${parsed.reason === 'not_an_email' ? tAdmin('grid.invalidEmail') : tAdmin('grid.notANumber')}`); return; }
        if (!cellChanged(page.properties[prop.id], parsed.value)) return;
        updatePageProperty(database.id, page.id, prop.id, parsed.value as never);
    }, [database, updatePageProperty, tAdmin]);

    /** A control cell's value — ONE field, written only when it changed; an exported document stays as it is. */
    const commitValue = useCallback((page: Page, prop: Property, v: unknown) => {
        if (!database || !access.edit) return;
        if (page.properties.accountantExportedAt === true) { toast.message(tAdmin('grid.exportedLockedToast')); return; }
        if (!cellChanged(page.properties[prop.id], v)) return;
        updatePageProperty(database.id, page.id, prop.id, v as never);
    }, [database, updatePageProperty, access.edit, tAdmin]);

    const startEdit = (page: Page, prop: Property) => {
        if (!access.edit) return;
        if (page.properties.accountantExportedAt === true) { toast.message(tAdmin('grid.exportedLockedToast')); return; }
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
        header: () => <span className="truncate">{tAdmin.has(`db.col.${prop.id}`) ? tAdmin(`db.col.${prop.id}` as never) : prop.name}</span>,   // the old grid's ColumnHeader convention
        size: widthOf(prop.id),
        // Called as a FUNCTION below, never through flexRender: flexRender mounts it as a component, and this function is
        // new on every store change — every cell remounted, so the click that ended an edit landed on a node that no
        // longer existed (Florin: "some rows need two clicks"; a select's open list closed by itself).
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
            if ((prop.type as string) === 'comments') return <LatestCommentCell pageId={page.id} databaseId={databaseId} onOpen={openRecord} flyout wrap={wrap} />;
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
            const text = cellDisplay(prop as never, value, id => resolveRelationTitle(id));
            const editable = isTextEditable(prop as never);
            return (
                <div
                    className={`w-full h-full px-2 flex gap-1 text-sm ${wrap ? 'items-start py-2' : 'items-center truncate'} ${NUMERIC_TYPES.has(prop.type) ? 'justify-end tabular-nums' : ''} ${editable ? 'cursor-text' : 'text-neutral-600 dark:text-neutral-400'}`}
                    onClick={() => { if (editable) startEdit(page, prop); }}
                >
                    <span className={`${wrap ? 'whitespace-pre-wrap break-words min-w-0' : 'truncate'} ${prop.id === 'title' ? 'font-medium' : ''}`}>{text}</span>
                    {prop.id === 'title' && (
                        <button type="button" title={tAdmin('grid.open')} onClick={ev => { ev.stopPropagation(); openRecord(page.id); }}
                                className="ml-auto shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500">
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {prop.id === 'title' && page.properties.accountantExportedAt === true && <Lock className="w-3 h-3 text-neutral-400 shrink-0" />}
                </div>
            );
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [columns, editing, widthOf, commit, commitValue, openRecord, databaseId, rows, locate, openLinked, database, access.edit, wrap, tAdmin]);

    if (!database) return null;
    const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
    const toggleRow = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const deleteSelected = () => {
        if (!access.delete || preventDelete === true) return;
        // a screen's own row guard (e.g. invoices: draft only) — the rest is refused by the door anyway
        const ids = [...selected].filter(id => { const r = rows.find(x => x.id === id); return r && !(typeof preventDelete === 'function' && preventDelete(r)); });
        if (!ids.length) { toast.message(tAdmin('grid.cannotDeleteNonDrafts')); return; }
        if (!window.confirm(tAdmin('grid.confirmDeleteCount', { count: ids.length }))) return;
        // the door refuses an issued document (sent invoice, sent quote, exported record) — the store puts it back and says why
        deletePages(database.id, ids);
        setSelected(new Set());
    };

    const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
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
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (editing || !active || !database) return;
        e.preventDefault();
        if (!access.edit) { toast.message(tAdmin('grid.readOnlyPaste')); return; }
        const block = parseClipboardGrid(e.clipboardData.getData('text/plain'));
        const r0 = rows.findIndex(p => p.id === active.pageId), c0 = columns.findIndex(p => p.id === active.propId);
        let written = 0;
        const skipped: string[] = [];
        block.forEach((line, i) => line.forEach((txt, j) => {
            const page = rows[r0 + i], prop = columns[c0 + j];
            if (!page || !prop) { skipped.push(tAdmin('grid.pasteOutsideGrid')); return; }
            if (page.properties.accountantExportedAt === true) { skipped.push(tAdmin('grid.pasteExported')); return; }
            const v = pasteValue(prop as never, txt);
            if (!v.ok) { skipped.push(`${prop.name}: ${v.reason}`); return; }
            if (!cellChanged(page.properties[prop.id], v.value)) return;
            updatePageProperty(database.id, page.id, prop.id, v.value as never);   // ONE field per cell
            written++;
        }));
        if (skipped.length) toast.message(tAdmin('grid.pasteSummary', { written, skipped: skipped.length, reasons: Array.from(new Set(skipped)).slice(0, 3).join('; ') }));
        else if (written) toast.success(tAdmin('grid.pastedCount', { count: written }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editing || !active) return;
        const r = rows.findIndex(p => p.id === active.pageId), c = columns.findIndex(p => p.id === active.propId);
        const go = (dr: number, dc: number) => {
            const nr = Math.max(0, Math.min(rows.length - 1, r + dr)), nc = Math.max(0, Math.min(columns.length - 1, c + dc));
            if (rows[nr] && columns[nc]) { setActive({ pageId: rows[nr].id, propId: columns[nc].id }); }
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
    };

    const footer = ((!hideFooterNew && access.create) || selected.size > 0) ? (
        <div className="flex items-center justify-between gap-3 min-h-[36px] px-2 border-t border-neutral-200 dark:border-white/10">
            <div className="flex items-center">
                {!hideFooterNew && access.create && (
                    <button type="button"
                        onClick={() => {
                            const page = createPage(database.id, hardFilter ? { [hardFilter.propertyId]: hardFilter.value } : {});
                            const title = database.properties.find(p => p.id === 'title');
                            if (page && title) setEditing({ pageId: page.id, propId: 'title', text: '' });
                        }}
                        className="flex items-center gap-1.5 px-1 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                        <Plus className="w-3.5 h-3.5" /> {tAdmin('grid.new')}
                    </button>
                )}
            </div>
            {selected.size > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">{tAdmin('grid.selectedCount', { count: selected.size })}</span>
                    {access.delete && preventDelete !== true && (
                        <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 className="w-3.5 h-3.5" /> {tAdmin('grid.delete')}</button>
                    )}
                    <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-neutral-500 hover:underline">{tAdmin('grid.clearSelection')}</button>
                    {/* VALIDATE-1 · "Te valideren": approve the selected records whose essentials are there — one field each;
                        the others stay, named with what they lack (the door refuses an incomplete approval anyway) */}
                    {access.edit && validationScreen === 'to-validate' && (
                        <button type="button" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                                onClick={() => {
                                    const plan = approvalPlan(database.logicalKey, rows.filter(r => selected.has(r.id)));
                                    const names = (ids: string[]) => ids.map(f => database.properties.find(p => p.id === f)?.name || f).join(', ');
                                    if (!plan.approve.length) {
                                        toast.message(tAdmin('grid.nothingToApproveMissing', { count: plan.refused.length, fields: names([...new Set(plan.refused.flatMap(r => r.missing))]) }));
                                        return;
                                    }
                                    const rest = plan.refused.length ? `\n${tAdmin('grid.refusedRemainIncomplete', { count: plan.refused.length })}` : '';
                                    if (!window.confirm(`${tAdmin('grid.confirmApproveCount', { count: plan.approve.length })}${rest}`)) return;
                                    for (const id of plan.approve) updatePageProperty(database.id, id, 'reviewStatus', REVIEW_APPROVED);
                                    setSelected(new Set(plan.refused.map(r => r.id)));
                                }}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> {tAdmin('grid.approve')}
                        </button>
                    )}
                </div>
            )}
        </div>
    ) : null;

    return (
        <DataGridSurface
            data={rows}
            columns={colDefs}
            getRowId={r => r.id}
            wrap={wrap}
            rowHeight={ROW_H}
            columnIds={columns.map(c => c.id)}
            widthOf={widthOf}
            onColumnMove={(from, to) => saveColumns(moveColumn(activeView?.propertiesState, columns.map(c => c.id), from, to))}
            onColumnResize={(colId, w) => saveColumns(setColumnWidth(activeView?.propertiesState, colId, w))}
            onColumnResizeReset={(colId) => saveColumns(setColumnWidth(activeView?.propertiesState, colId, colId === 'title' ? 260 : 160))}
            selected={selected}
            onToggleRow={toggleRow}
            onSelectAll={all => setSelected(all ? new Set(rows.map(r => r.id)) : new Set())}
            allSelected={allSelected}
            showSelectionColumn={true}
            active={active ? { rowId: active.pageId, colId: active.propId } : null}
            onActiveChange={a => setActive(a ? { pageId: a.rowId, propId: a.colId } : null)}
            scrollRef={scrollRef}
            onKeyDown={handleKeyDown}
            onCopy={handleCopy}
            onPaste={handlePaste}
            renderRowLeading={(page, index) => (
                <>
                    <span className={selected.has(page.id) ? 'hidden' : 'group-hover:hidden'}>{index + 1}</span>
                    <input type="checkbox" aria-label={tAdmin('grid.selectRow')} checked={selected.has(page.id)} onChange={() => toggleRow(page.id)}
                           className={`w-3.5 h-3.5 accent-orange-500 ${selected.has(page.id) ? '' : 'hidden group-hover:block'}`} />
                    <span className="hidden group-hover:inline-flex">
                        <RowMenu
                            onOpen={() => openRecord(page.id)}
                            onDuplicate={(() => {
                                const dup = access.create ? duplicateProperties(database.logicalKey, page.properties) : null;
                                return dup ? () => { createPage(database.id, dup as never); } : undefined;
                            })()}
                            onDelete={access.delete && preventDelete !== true && !(typeof preventDelete === 'function' && preventDelete(page))
                                ? () => { if (window.confirm(tAdmin('grid.confirmDeleteOne'))) deletePages(database.id, [page.id]); }
                                : undefined}
                        />
                    </span>
                </>
            )}
            renderTabs={renderTabs}
            renderFooter={footer}
        />
    );
}
