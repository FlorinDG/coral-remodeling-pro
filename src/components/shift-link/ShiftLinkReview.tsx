"use client";
/**
 * SHIFT-LINK-1 · recorded hours that are not (or wrongly) linked to a planned shift, each with an
 * EDITABLE suggestion: the select starts on the best-overlapping shift and offers every shift of that
 * worker's day plus "no shift" (Florin 2026-10-01: "not just deny it, but actually replace it").
 *
 * One component for both apps — labels come from the host (crew: react-i18next, ERP: next-intl).
 * Renders nothing when there is nothing to review.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { listShiftLinkReview, linkEntryToShift, type ShiftLinkItem, type ShiftOption } from '@/lib/data/entry-shift-link';
import { formatWeekdayDayMonth, formatTime } from '@/lib/format/date';

export interface ShiftLinkLabels {
    title: string;
    hint: string;
    unlinked: string;
    mismatch: string;
    linkedTo: string;
    noShift: string;
    link: string;
    keep: string;
    noOverlap: string;
    submitted: string;
    failed: string;
}

export const SHIFT_LINK_KEYS = ['title', 'hint', 'unlinked', 'mismatch', 'linkedTo', 'noShift', 'link', 'keep', 'noOverlap', 'submitted', 'failed'] as const;

export function ShiftLinkReview({ labels, locale, mine = false, showWorker = false, days = 14, onLinked, className = '' }: {
    labels: ShiftLinkLabels;
    locale: string;
    mine?: boolean;
    showWorker?: boolean;
    days?: number;
    onLinked?: () => void;
    className?: string;
}) {
    const [items, setItems] = useState<ShiftLinkItem[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await listShiftLinkReview(days, mine);
        if (res.ok) { setItems(res.items); setLoadError(null); } else setLoadError(res.error);
    }, [days, mine]);
    useEffect(() => { load(); }, [load]);

    if (loadError) {
        return <p className={`text-sm text-amber-700 dark:text-amber-300 ${className}`}>{labels.failed}: {loadError}</p>;
    }
    if (!items.length) return null;

    return (
        <section className={`rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-3 ${className}`}>
            <div className="flex items-start gap-2">
                <Link2 className="w-5 h-5 mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" />
                <div>
                    <h2 className="text-base font-semibold text-foreground">{labels.title} ({items.length})</h2>
                    <p className="text-sm text-muted-foreground">{labels.hint}</p>
                </div>
            </div>
            <ul className="space-y-2">
                {items.map(item => (
                    <Row key={item.entryId} item={item} labels={labels} locale={locale} showWorker={showWorker}
                        onDone={() => { setItems(list => list.filter(i => i.entryId !== item.entryId)); onLinked?.(); }} />
                ))}
            </ul>
        </section>
    );
}

function optionText(o: ShiftOption, labels: ShiftLinkLabels, locale: string) {
    const span = `${o.traceNo ? `${o.traceNo} · ` : ''}${formatTime(o.start, locale)}–${formatTime(o.end, locale)}`;   // TRACE-1
    const extra = [o.label, o.submitted ? labels.submitted : '', o.overlap === 0 ? labels.noOverlap : ''].filter(Boolean).join(' · ');
    return extra ? `${span} · ${extra}` : span;
}

function Row({ item, labels, locale, showWorker, onDone }: {
    item: ShiftLinkItem; labels: ShiftLinkLabels; locale: string; showWorker: boolean; onDone: () => void;
}) {
    const NONE = '__none__';
    const [choice, setChoice] = useState<string>(item.suggestedShiftId ?? NONE);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const keeps = choice === (item.currentShift?.id ?? NONE);

    const apply = async () => {
        setBusy(true); setError(null);
        const res = await linkEntryToShift(item.entryId, choice === NONE ? null : choice);
        setBusy(false);
        if (res.ok) onDone(); else setError(res.error);
    };

    return (
        <li className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-base font-semibold text-foreground">
                    {item.traceNo && <span className="font-mono text-sm text-muted-foreground mr-1.5">{item.traceNo}</span>}
                    {showWorker && item.workerName ? `${item.workerName} · ` : ''}
                    <span className="capitalize">{formatWeekdayDayMonth(`${item.date}T12:00:00`, locale)}</span>
                    {' · '}<span className="tabular-nums">{formatTime(item.start, locale)}–{formatTime(item.end === '24:00' ? '00:00' : item.end, locale)}</span>
                </p>
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    {item.reason === 'unlinked' ? labels.unlinked : labels.mismatch}
                </span>
            </div>
            {item.currentShift && (
                <p className="text-sm text-muted-foreground">{labels.linkedTo}: {optionText(item.currentShift, labels, locale)}</p>
            )}
            <div className="flex gap-2">
                <select value={choice} onChange={e => setChoice(e.target.value)} disabled={busy}
                    className="flex-1 min-w-0 h-11 px-3 rounded-lg border border-border bg-background text-sm">
                    {item.options.map(o => <option key={o.id} value={o.id}>{optionText(o, labels, locale)}</option>)}
                    {item.currentShift && !item.options.some(o => o.id === item.currentShift!.id) && (
                        <option value={item.currentShift.id}>{optionText(item.currentShift, labels, locale)}</option>
                    )}
                    <option value={NONE}>{labels.noShift}</option>
                </select>
                <button type="button" onClick={apply} disabled={busy}
                    className="h-11 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}{keeps ? labels.keep : labels.link}
                </button>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{labels.failed}: {error}</p>}
        </li>
    );
}
