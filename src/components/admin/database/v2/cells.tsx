'use client';
/**
 * GRID-REPLACE-2 · the new grid's control cells — a pick-list, a tick, a calendar day. Each commits ONE field
 * (`onCommit(value)`), never a row. No document-level listeners: the pick-list closes on its own overlay.
 * Rules: lib/records/grid-cell.ts (toggleOption, cellChanged), lib/records/date-cell.ts.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ExternalLink, Search, Calculator } from 'lucide-react';
import { useRelationTarget, resolveRelationTitle } from '@/lib/relations/resolve';
import type { RollupResult } from '@/lib/records/rollup';
import { COLOR_STYLES } from '../columns/SelectColumn';
import { toggleOption } from '@/lib/records/grid-cell';
import { normaliseDateValue, formatDisplayDate } from '@/lib/records/date-cell';

type Option = { id: string; name: string; color?: string };

function Badge({ opt }: { opt: Option }) {
    const st = COLOR_STYLES[opt.color || 'default'] || COLOR_STYLES.default;
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${st.badge}`}>{opt.name}</span>;
}

/** Select / multi-select: the value as badges; a click opens the list; picking commits at once. */
export function SelectCell({ value, options, multi, readOnly, onCommit }: {
    value: unknown; options: Option[]; multi: boolean; readOnly?: boolean; onCommit: (v: unknown) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const selected = (multi ? (Array.isArray(value) ? value : value ? [value] : []) : (value ? [value] : [])).map(String);

    useLayoutEffect(() => {
        if (!open || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const h = Math.min(options.length * 32 + 16, 280);
        const top = window.innerHeight - r.bottom < h && r.top > h ? r.top - h - 4 : r.bottom + 4;
        setPos({ top, left: r.left, width: Math.max(r.width, 200) });
    }, [open, options.length]);

    const pick = (id: string) => {
        if (multi) onCommit(toggleOption(selected, id));
        else { onCommit(selected[0] === id ? null : id); setOpen(false); }
    };

    return (
        <div ref={ref} className={`w-full h-full px-2 flex items-center gap-1 overflow-hidden ${readOnly ? '' : 'cursor-pointer'}`} onClick={() => !readOnly && setOpen(true)}>
            {selected.map(id => { const o = options.find(x => x.id === id); return o ? <Badge key={id} opt={o} /> : <span key={id} className="text-xs text-neutral-400">{id}</span>; })}
            {open && pos && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99998]" onMouseDown={() => setOpen(false)}>
                    <div
                        className="fixed bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg shadow-xl py-1 overflow-y-auto"
                        style={{ top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: 280 }}
                        onMouseDown={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
                    >
                        {options.length === 0 && <div className="px-3 py-1.5 text-xs text-neutral-400">—</div>}
                        {options.map(o => (
                            <button key={o.id} type="button" onClick={() => pick(o.id)} className="w-full flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-white/5">
                                <Badge opt={o} />
                                {selected.includes(o.id) && <Check className="w-3.5 h-3.5 text-orange-500" />}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

/** Checkbox: one click toggles and commits. */
export function CheckboxCell({ value, readOnly, onCommit }: { value: unknown; readOnly?: boolean; onCommit: (v: unknown) => void }) {
    const on = value === true;
    return (
        <div className="w-full h-full flex items-center justify-center">
            <input type="checkbox" checked={on} disabled={readOnly} onChange={() => onCommit(!on)}
                   className="w-4 h-4 accent-orange-500 cursor-pointer disabled:cursor-default" />
        </div>
    );
}

/** Date: a calendar day 'YYYY-MM-DD' (a reminder bell kept); a click opens the native day picker. */
export function DateCell({ value, readOnly, onCommit }: { value: unknown; readOnly?: boolean; onCommit: (v: unknown) => void }) {
    const raw = typeof value === 'string' ? value : '';
    const norm = normaliseDateValue(raw);
    const bell = norm.endsWith(' 🔔');
    const day = norm.replace(' 🔔', '');
    const [editing, setEditing] = useState(false);
    if (editing && !readOnly) {
        return (
            <input
                type="date"
                autoFocus
                defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ''}
                onBlur={e => { const v = e.target.value; setEditing(false); onCommit(v ? (bell ? `${v} 🔔` : v) : null); }}
                onKeyDown={e => {
                    if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                }}
                className="w-full h-full px-2 text-sm bg-white dark:bg-neutral-900 outline-none ring-2 ring-inset ring-orange-400"
            />
        );
    }
    return (
        <div className={`w-full h-full px-2 flex items-center text-sm truncate ${readOnly ? '' : 'cursor-pointer'}`} onClick={() => !readOnly && setEditing(true)}>
            {formatDisplayDate(raw)}
        </div>
    );
}

// ── GRID-REPLACE-2 (continued) · relation, rollup, formula, variants ─────────────────────────────────────────

/**
 * Relation: chips (open the related record in place — CROSS-LINK-1); a click on the cell opens a searchable list of
 * the target database's records; picking toggles one link and commits the field.
 */
export function RelationCell({ value, relationDatabaseId, displayPropertyId, readOnly, onCommit, onOpen }: {
    value: unknown; relationDatabaseId: string; displayPropertyId?: string; readOnly?: boolean;
    onCommit: (v: unknown) => void; onOpen: (databaseId: string, pageId: string) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const target = useRelationTarget(open ? relationDatabaseId : null, { displayPropertyId, autoLoad: true });
    const ids = (Array.isArray(value) ? value : value ? [value] : []).map(String);
    const titleOf = (id: string) => resolveRelationTitle(id, { displayPropertyId }) || '…';
    const resolvedDb = useRelationTarget(relationDatabaseId, { displayPropertyId, autoLoad: false }).databaseId;

    useLayoutEffect(() => {
        if (!open || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const top = window.innerHeight - r.bottom < 320 && r.top > 320 ? r.top - 324 : r.bottom + 4;
        setPos({ top, left: r.left, width: Math.max(r.width, 260) });
    }, [open]);

    const options = (target.options || []).filter(o => !q.trim() || (o.title || '').toLowerCase().includes(q.trim().toLowerCase())).slice(0, 200);

    return (
        <div ref={ref} className={`w-full h-full px-2 flex items-center gap-1 overflow-hidden ${readOnly ? '' : 'cursor-pointer'}`} onClick={() => !readOnly && setOpen(true)}>
            {ids.map(id => (
                <span key={id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 whitespace-nowrap group/chip">
                    {titleOf(id)}
                    <button type="button" title="Openen" onClick={e => { e.stopPropagation(); onOpen(resolvedDb || relationDatabaseId, id); }}
                            className="p-0.5 rounded opacity-0 group-hover/chip:opacity-100 text-orange-500 hover:bg-neutral-200 dark:hover:bg-neutral-700">
                        <ExternalLink className="w-3 h-3" />
                    </button>
                </span>
            ))}
            {open && pos && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99998]" onMouseDown={() => { setOpen(false); setQ(''); }}>
                    <div className="fixed bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg shadow-xl flex flex-col"
                         style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 320 }} onMouseDown={e => e.stopPropagation()}>
                        <div className="p-2 border-b border-neutral-100 dark:border-white/10 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-neutral-400" />
                            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Zoeken…"
                                   onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQ(''); } }}
                                   className="flex-1 bg-transparent text-sm outline-none" />
                        </div>
                        <div className="overflow-y-auto py-1">
                            {target.status === 'unknown-database' && <div className="px-3 py-2 text-xs text-red-500">Doeldatabase niet gevonden</div>}
                            {target.status !== 'unknown-database' && options.length === 0 && <div className="px-3 py-2 text-xs text-neutral-400">{target.status === 'not-loaded' ? 'Laden…' : '—'}</div>}
                            {options.map(o => (
                                <button key={o.id} type="button" onClick={() => onCommit(toggleOption(ids, o.id))}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left hover:bg-neutral-100 dark:hover:bg-white/5">
                                    <span className="truncate">{o.title}</span>
                                    {ids.includes(o.id) && <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

/** Rollup: the related records' field (lib/records/rollup — the one rule), each value opens its record. */
export function RollupCell({ values, onOpen }: { values: RollupResult[]; onOpen: (databaseId: string, pageId: string) => void }) {
    if (!values.length) return <div className="w-full h-full px-2 flex items-center text-neutral-300 dark:text-neutral-600 text-sm">—</div>;
    return (
        <div className="w-full h-full px-2 flex items-center gap-1 overflow-hidden">
            {values.map((v, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 whitespace-nowrap group/chip">
                    {v.value}
                    {v.targetDbId && v.targetPageId && (
                        <button type="button" title="Openen" onClick={e => { e.stopPropagation(); onOpen(v.targetDbId!, v.targetPageId!); }}
                                className="p-0.5 rounded opacity-0 group-hover/chip:opacity-100 text-orange-500 hover:bg-neutral-200 dark:hover:bg-neutral-700">
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    )}
                </span>
            ))}
        </div>
    );
}

/** Formula: computed on read (formulaEngine), never written. */
export function FormulaCell({ result }: { result: unknown }) {
    const isError = result === '#ERROR!';
    const text = result === null || result === undefined || result === '' || (typeof result === 'number' && !Number.isFinite(result)) ? '—' : String(result);
    return (
        <div className="w-full h-full px-2 flex items-center gap-1.5 overflow-hidden">
            <Calculator className={`w-3 h-3 shrink-0 ${isError ? 'text-red-500' : 'text-neutral-400'}`} />
            <span className={`truncate text-sm ${isError ? 'text-red-500 font-medium' : 'text-neutral-700 dark:text-neutral-300'}`}>{text}</span>
        </div>
    );
}
