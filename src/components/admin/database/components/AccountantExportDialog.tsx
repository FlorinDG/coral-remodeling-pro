"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Checkbox } from '@/components/common/Checkbox';
import { formatDate } from '@/lib/format/date';
import { Loader2, Download, AlertCircle, FileArchive, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AccountantExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialPreset?: string;
    initialFrom?: string;
    initialTo?: string;
}

interface PreviewCounts {
    toExportCount: number;
    alreadyExportedCount: number;
    draftCount: number;
    undatedCount: number;
    undatedDocuments?: Array<{ id: string; title: string; type: string }>;
}

export function AccountantExportDialog({
    isOpen,
    onClose,
    initialPreset = 'this-year',
    initialFrom = '',
    initialTo = '',
}: AccountantExportDialogProps) {
    const [preset, setPreset] = useState<string>(initialPreset);
    const [dateFrom, setDateFrom] = useState<string>(initialFrom);
    const [dateTo, setDateTo] = useState<string>(initialTo);
    const [includeAlreadyExported, setIncludeAlreadyExported] = useState<boolean>(false);

    const [counts, setCounts] = useState<PreviewCounts | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState<boolean>(false);

    // Synchronize initial dates whenever dialog opens
    useEffect(() => {
        if (isOpen) {
            setPreset(initialPreset);
            setDateFrom(initialFrom);
            setDateTo(initialTo);
            setIncludeAlreadyExported(false);
            setCounts(null);
            setPreviewError(null);
        }
    }, [isOpen, initialPreset, initialFrom, initialTo]);

    // Resolve date range from preset
    const { from, to } = useMemo(() => {
        const now = new Date();
        let f = dateFrom;
        let t = dateTo;

        if (preset !== 'custom') {
            const y = now.getFullYear();
            const m = now.getMonth();
            switch (preset) {
                case 'last-month': {
                    const d = new Date(y, m - 1, 1);
                    f = d.toISOString().split('T')[0];
                    t = new Date(y, m, 0).toISOString().split('T')[0];
                    break;
                }
                case 'last-trimester': {
                    const qStart = Math.floor(m / 3) * 3;
                    f = new Date(y, qStart - 3, 1).toISOString().split('T')[0];
                    t = new Date(y, qStart, 0).toISOString().split('T')[0];
                    break;
                }
                case 'last-semester': {
                    if (m < 6) {
                        f = `${y - 1}-07-01`;
                        t = `${y - 1}-12-31`;
                    } else {
                        f = `${y}-01-01`;
                        t = `${y}-06-30`;
                    }
                    break;
                }
                case 'this-year':
                    f = `${y}-01-01`;
                    t = now.toISOString().split('T')[0];
                    break;
                case 'last-year':
                case 'last-calendar-year':
                    f = `${y - 1}-01-01`;
                    t = `${y - 1}-12-31`;
                    break;
            }
        }
        return { from: f, to: t };
    }, [preset, dateFrom, dateTo]);

    // Fetch live counts from server preview endpoint
    const fetchPreview = useCallback(async (f: string, t: string, include: boolean) => {
        if (!f || !t) {
            setCounts(null);
            setPreviewError(null);
            return;
        }

        setIsLoadingPreview(true);
        setPreviewError(null);

        try {
            const url = new URL('/api/financials/export', window.location.origin);
            url.searchParams.set('startDate', f);
            url.searchParams.set('endDate', t);
            url.searchParams.set('preview', 'true');
            if (include) url.searchParams.set('includeAlreadyExported', 'true');

            const res = await fetch(url.toString());
            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                setPreviewError(errData?.error || 'Kon tellingen niet ophalen');
                setCounts(null);
                return;
            }

            const data = await res.json();
            setCounts({
                toExportCount: data.toExportCount ?? 0,
                alreadyExportedCount: data.alreadyExportedCount ?? 0,
                draftCount: data.draftCount ?? 0,
                undatedCount: data.undatedCount ?? 0,
                undatedDocuments: data.undatedDocuments || [],
            });
        } catch (err: any) {
            console.error('Failed to fetch preview counts:', err);
            setPreviewError('Netwerkfout bij ophalen van tellingen');
            setCounts(null);
        } finally {
            setIsLoadingPreview(false);
        }
    }, []);

    // Re-fetch preview counts when period or include flag changes
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            fetchPreview(from, to, includeAlreadyExported);
        }, 150);
        return () => clearTimeout(timer);
    }, [isOpen, from, to, includeAlreadyExported, fetchPreview]);

    const canExport = Boolean(from && to && !isLoadingPreview && !isExporting);

    const handleExecuteExport = async () => {
        if (!from || !to) {
            toast.error('Selecteer zowel een begin- als einddatum.');
            return;
        }

        setIsExporting(true);
        const toastId = toast.loading('Boekhouder export voorbereiden...');

        try {
            const url = new URL('/api/financials/export', window.location.origin);
            url.searchParams.set('startDate', from);
            url.searchParams.set('endDate', to);
            if (includeAlreadyExported) {
                url.searchParams.set('includeAlreadyExported', 'true');
            }

            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                if (data?.failedDocuments && data.failedDocuments.length > 0) {
                    const sample = data.failedDocuments
                        .map((d: any) => `${d.title || d.id} (${d.type})`)
                        .slice(0, 5)
                        .join(', ');
                    const overflow = data.failedDocuments.length > 5 ? ` (+${data.failedDocuments.length - 5} meer)` : '';
                    toast.error(`Export mislukt: documenten ontbreken of onleesbaar: ${sample}${overflow}`, {
                        id: toastId,
                        duration: 8000,
                    });
                } else {
                    toast.error(`Export mislukt: ${data?.error || res.statusText}`, { id: toastId });
                }
                return;
            }

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `boekhouding_export_${from}_tot_${to}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

            toast.success('Boekhouder export succesvol gedownload!', { id: toastId });

            const excludedDraftsHeader = res.headers.get('X-Excluded-Drafts-Count');
            const excludedDrafts = excludedDraftsHeader ? parseInt(excludedDraftsHeader, 10) : 0;
            if (excludedDrafts > 0) {
                toast.info(
                    `${excludedDrafts} conceptdocument${excludedDrafts > 1 ? 'en' : ''} in deze periode ${excludedDrafts > 1 ? 'zijn' : 'is'} niet opgenomen in de export.`,
                    { duration: 7000 }
                );
            }

            onClose();
        } catch (err: any) {
            console.error('Accountant export download failed:', err);
            toast.error('Boekhouder export mislukt: netwerk- of serverfout.', { id: toastId });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isExporting) onClose(); }}>
            <DialogContent className="sm:max-w-[540px] bg-white dark:bg-neutral-900 border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white p-6 gap-5">
                <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <FileArchive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        Boekhouder export instellingen
                    </DialogTitle>
                    <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                        Configureer de periode en opties voor het officiële boekhoudpakket (ZIP met PDF’s en dagboeken).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Period selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                            Periode
                        </label>
                        <SearchableSelect
                            options={[
                                { value: 'this-year', label: 'Dit Jaar' },
                                { value: 'last-month', label: 'Vorige Maand' },
                                { value: 'last-trimester', label: 'Vorig Kwartaal (Trimester)' },
                                { value: 'last-semester', label: 'Vorig Semester' },
                                { value: 'last-calendar-year', label: 'Vorig Kalenderjaar' },
                                { value: 'last-year', label: 'Vorig Jaar' },
                                { value: 'custom', label: 'Aangepaste Periode' },
                            ]}
                            value={preset}
                            onChange={(val) => {
                                setPreset(val);
                                if (val !== 'custom') {
                                    setDateFrom('');
                                    setDateTo('');
                                }
                            }}
                            placeholder="Selecteer periode..."
                        />

                        {preset === 'custom' && (
                            <div className="flex items-center gap-2 pt-1.5">
                                <div className="flex-1">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                </div>
                                <span className="text-xs text-neutral-400">&rarr;</span>
                                <div className="flex-1">
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Checkbox: Include already exported */}
                    <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-white/[0.02] p-3 space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <div className="pt-0.5">
                                <Checkbox
                                    checked={includeAlreadyExported}
                                    onChange={(checked) => setIncludeAlreadyExported(checked)}
                                    className="w-4 h-4"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-snug block">
                                    Documenten die al naar de boekhouder zijn verzonden opnieuw opnemen
                                </span>
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed block">
                                    Standaard uitgeschakeld om dubbele verzendingen te voorkomen.
                                </span>
                            </div>
                        </label>

                        {includeAlreadyExported && (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-200/60 dark:border-amber-500/20">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                                <span>Geen records worden opnieuw gemarkeerd als verzonden — ze zijn dit al.</span>
                            </div>
                        )}
                    </div>

                    {/* Live Server Count Preview Box */}
                    <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800/40 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                            <span>
                                Periode {from && to ? `${formatDate(from)} → ${formatDate(to)}` : 'Nog niet ingesteld'}
                            </span>
                            {isLoadingPreview && (
                                <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                                    Tellen...
                                </span>
                            )}
                        </div>

                        {previewError ? (
                            <p className="text-xs text-red-600 dark:text-red-400">{previewError}</p>
                        ) : counts ? (
                            <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 font-mono">
                                <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-400">
                                    <span>{counts.toExportCount} documenten worden geëxporteerd</span>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px]">
                                    <span>
                                        {counts.alreadyExportedCount} al naar boekhouder verzonden
                                    </span>
                                    <span className="font-semibold">
                                        {includeAlreadyExported ? 'opgenomen' : 'uitgesloten'}
                                    </span>
                                </div>
                                {counts.undatedCount > 0 && (
                                    <div className="space-y-1 pt-0.5 border-t border-neutral-200/50 dark:border-white/5">
                                        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px]">
                                            <span>{counts.undatedCount} zonder factuurdatum</span>
                                            <span className="font-semibold text-amber-600 dark:text-amber-400">niet opgenomen</span>
                                        </div>
                                        {counts.undatedDocuments && counts.undatedDocuments.length > 0 && (
                                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate" title={counts.undatedDocuments.map(d => `${d.title} (${d.type})`).join(', ')}>
                                                Ontbreekt datum: {counts.undatedDocuments.slice(0, 3).map(d => `${d.title} (${d.type})`).join(', ')}
                                                {counts.undatedDocuments.length > 3 && ` (+${counts.undatedDocuments.length - 3} meer)`}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {counts.draftCount > 0 && (
                                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px]">
                                        <span>{counts.draftCount} conceptdocumenten</span>
                                        <span className="font-semibold">uitgesloten</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-neutral-400">
                                {!from || !to ? 'Vul een begin- en einddatum in om de tellingen te bekijken.' : 'Tellingen laden...'}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-white/10">
                    <div className="text-[11px] text-neutral-500">
                        {(!from || !to) && (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Begin- en einddatum vereist
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isExporting}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                        >
                            Annuleren
                        </button>
                        <button
                            type="button"
                            onClick={handleExecuteExport}
                            disabled={!canExport}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition shadow-sm"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Exporteren...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Exporteer ZIP</span>
                                </>
                            )}
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
