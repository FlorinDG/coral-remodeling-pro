"use client";
/**
 * LINE-SEARCH-1 · "Zoeken in regels": find a material in the lines of purchase invoices and supplier quotes, open its
 * document, or take the line into the library (Florin 2026-10-08/09). The search and the library write are server doors
 * (app/actions/purchase-lines); this window only asks and shows.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, ExternalLink, BookPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { searchPurchaseLines, addPurchaseLineToLibrary } from '@/app/actions/purchase-lines';
import { libraryUnitOf, type LineHit } from '@/lib/records/purchase-line-search';
import { formatEuro } from '@/lib/records/grid-cell';
import { formatCalendarDay } from '@/lib/format/date';

/** The library's units (kernel db-articles 'prop-art-unit'); "stuk" by default. */
const UNITS: ReadonlyArray<{ id: string; name: string }> = [
    { id: 'u-stk', name: 'stuk' }, { id: 'u-m', name: 'm' }, { id: 'u-m2', name: 'm²' }, { id: 'u-m3', name: 'm³' },
    { id: 'u-l', name: 'L' }, { id: 'u-uur', name: 'uur' }, { id: 'u-set', name: 'set' }, { id: 'u-kg', name: 'kg' },
];

interface Props {
    onClose: () => void;
    /** Open a found line's document in the purchase editor. */
    onOpenDocument: (databaseId: string, documentId: string) => void;
}

export default function PurchaseLineSearch({ onClose, onOpenDocument }: Props) {
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<LineHit[]>([]);
    const [busy, setBusy] = useState(false);
    const [adding, setAdding] = useState<{ key: string; unit: string } | null>(null);
    const [added, setAdded] = useState<Set<string>>(new Set());
    const seq = useRef(0);

    useEffect(() => {
        const q = query.trim();
        if (!q) { setHits([]); return; }
        const mine = ++seq.current;
        setBusy(true);
        const t = setTimeout(async () => {
            const r = await searchPurchaseLines(q).catch(() => null);
            if (mine !== seq.current) return;   // a newer search is under way
            setBusy(false);
            if (!r || !r.ok) { toast.error('Zoeken mislukt'); return; }
            setHits(r.hits);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const keyOf = (h: LineHit) => `${h.documentId}:${h.lineId}`;

    const addToLibrary = async (h: LineHit, unit: string) => {
        const r = await addPurchaseLineToLibrary(h.documentId, h.lineId, unit).catch(() => null);
        if (!r || !r.ok) {
            toast.error(r && !r.ok && r.error === 'not_entitled' ? 'De bibliotheek hoort niet bij je abonnement' : 'Toevoegen aan de bibliotheek mislukt');
            return;
        }
        setAdded(prev => new Set(prev).add(keyOf(h)));
        setAdding(null);
        toast.success(r.created ? 'Artikel toegevoegd aan de bibliotheek' : 'Prijs van het bestaande artikel bijgewerkt (oude prijs bewaard)');
    };

    if (typeof document === 'undefined') return null;
    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Zoeken in regels" className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
            <div className="w-full max-w-4xl max-h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-white/10">
                    <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                    <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                           placeholder="Zoek een materiaal, artikelcode of leverancier — in aankoopfacturen en offertes"
                           className="flex-1 bg-transparent outline-none text-base text-neutral-900 dark:text-white placeholder:text-neutral-400" />
                    {busy && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
                    <button type="button" onClick={onClose} aria-label="Sluiten" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10"><X className="w-5 h-5 text-neutral-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {!query.trim() ? (
                        <p className="p-6 text-sm text-neutral-500">Typ één of meer woorden — elke regel die ze allemaal bevat, verschijnt, de nieuwste eerst.</p>
                    ) : hits.length === 0 && !busy ? (
                        <p className="p-6 text-sm text-neutral-500">Geen regels gevonden.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100 dark:divide-white/5">
                            {hits.map(h => {
                                const key = keyOf(h);
                                const isAdding = adding?.key === key;
                                return (
                                    <li key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-neutral-900 dark:text-white break-words">{h.description || '—'}</p>
                                            <p className="text-xs text-neutral-500 mt-0.5">
                                                {[h.articleCode, h.supplier, h.date ? formatCalendarDay(h.date, 'nl-BE') : '', `${h.role === 'purchase-quotes' ? 'Offerte' : 'Factuur'} ${h.documentTitle}`].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs tabular-nums shrink-0">
                                            <p className="font-semibold text-neutral-900 dark:text-white">{formatEuro(h.gross)} <span className="font-normal text-neutral-500">bruto</span></p>
                                            <p className="text-neutral-500">{h.discount ? `−${String(h.discount).replace('.', ',')}% · ` : ''}{h.quantity} × · {formatEuro(h.net)} netto</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button type="button" onClick={() => onOpenDocument(h.databaseId, h.documentId)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5">
                                                <ExternalLink className="w-3.5 h-3.5" /> Openen
                                            </button>
                                            {added.has(key) ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-600"><Check className="w-3.5 h-3.5" /> In bibliotheek</span>
                                            ) : isAdding ? (
                                                <>
                                                    <select value={adding.unit} onChange={e => setAdding({ key, unit: e.target.value })} aria-label="Eenheid"
                                                            className="px-2 py-1.5 rounded-lg text-xs border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800">
                                                        {UNITS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                    <button type="button" onClick={() => addToLibrary(h, adding.unit)}
                                                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--brand-color,#d35400)] hover:opacity-90">Toevoegen</button>
                                                </>
                                            ) : (
                                                <button type="button" onClick={() => setAdding({ key, unit: libraryUnitOf(h.unitCode) })}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--brand-color,#d35400)] hover:opacity-90">
                                                    <BookPlus className="w-3.5 h-3.5" /> Naar bibliotheek
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
