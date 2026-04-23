import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/time-tracker/components/ui/dialog';
import { Upload, FileText, Bot, AlertCircle, Check, ArrowRight, Loader2, Database, Lock, Copy } from 'lucide-react';
import { Block } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';

// ── Similarity engine ─────────────────────────────────────────────────────────
/** Normalise to lowercase alphanum only for comparison */
function normalise(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/** True if two titles are likely the same line item */
function isSimilar(a: string, b: string): boolean {
    const na = normalise(a);
    const nb = normalise(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    // Prefix match: if the shorter title is at least 70% of the longer, consider duplicate
    const shorter = na.length <= nb.length ? na : nb;
    const longer  = na.length <= nb.length ? nb : na;
    if (shorter.length >= 6 && longer.startsWith(shorter.slice(0, Math.ceil(shorter.length * 0.8)))) return true;
    return false;
}

/** Recursively collect all existing line-item content strings from the quotation tree */
function collectExistingTitles(blocks: Block[]): string[] {
    const out: string[] = [];
    for (const b of blocks) {
        if ((b.type === 'line' || b.type === 'post') && b.content) out.push(b.content);
        if (b.children?.length) out.push(...collectExistingTitles(b.children));
    }
    return out;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExtractedItem {
    title: string;
    brutoPrice?: number;
    discountPercent?: number;
    quantity?: number;
    unit?: string;
    brand?: string;
    packaging?: string;
    minimumOrder?: number;
    group?: string;
    calculationType?: string;
}

interface PDFImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (blocks: Block[]) => void;
    /** Current blocks in the quotation — used for dedup comparison */
    existingBlocks?: Block[];
    /** Whether tenant can use dedup (PRO+). Free tenants import all, no comparison. */
    canDedup?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PDFImportModal({
    isOpen,
    onClose,
    onImportComplete,
    existingBlocks = [],
    canDedup = false,
}: PDFImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [isDuplicate, setIsDuplicate] = useState<boolean[]>([]);
    const [selected, setSelected] = useState<boolean[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setExtractedItems([]);
            setSelected([]);
            setIsDuplicate([]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile?.type === 'application/pdf') {
            setFile(droppedFile);
            setError(null);
            setExtractedItems([]);
            setSelected([]);
            setIsDuplicate([]);
        } else if (droppedFile) {
            setError('Please upload a valid PDF document.');
        }
    };

    const processPDF = async () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server processing error');

            const items: ExtractedItem[] = data.articles || [];

            // Run dedup detection (PRO+ only)
            const existingTitles = canDedup ? collectExistingTitles(existingBlocks) : [];
            const dupeFlags = items.map(item =>
                canDedup && existingTitles.some(t => isSimilar(t, item.title || ''))
            );

            // Pre-select: non-duplicates → checked; duplicates → unchecked
            const selFlags = dupeFlags.map(d => !d);

            setExtractedItems(items);
            setIsDuplicate(dupeFlags);
            setSelected(selFlags);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Extraction failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleItem = (idx: number) => {
        setSelected(prev => prev.map((v, i) => i === idx ? !v : v));
    };

    const toggleAll = () => {
        const allOn = selected.every(Boolean);
        setSelected(selected.map(() => !allOn));
    };

    const confirmImport = () => {
        const itemsToImport = extractedItems.filter((_, i) => selected[i]);
        const generatedBlocks: Block[] = itemsToImport.map(item => {
            const bruto = item.brutoPrice || 0;
            const discount = item.discountPercent || 0;
            const defaultMarge = 20;
            const costAfterDiscount = bruto * (1 - discount / 100);
            const computedVerkoop = costAfterDiscount * (1 + defaultMarge / 100);

            return {
                id: crypto.randomUUID(),
                type: 'line' as const,
                content: item.title || 'Unknown Item',
                brutoPrice: bruto,
                discountPercent: discount,
                margePercent: defaultMarge,
                verkoopPrice: computedVerkoop,
                quantity: item.quantity || 1,
                unit: item.unit || 'stk',
                calculationType: (item.calculationType as Block['calculationType']) || 'materieel',
            };
        });

        onImportComplete(generatedBlocks);
        reset();
        onClose();
    };

    const handleDirectLibraryImport = () => {
        const store = useDatabaseStore.getState();
        const articleDb = store.getDatabase('db-articles');
        if (!articleDb) { setError('Global article database not found.'); return; }

        setIsProcessing(true);

        const findPropId = (keywords: string[]) =>
            articleDb.properties.find(p => p.name && keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase())))?.id;

        const map = {
            title:    findPropId(['naam', 'titel', 'title', 'name', 'artikel', 'code', 'omschrijving']) || 'title',
            bruto:    findPropId(['bruto', 'brutoprijs', 'kost', 'prijs', 'price', 'inkoop']) || '',
            discount: findPropId(['korting', 'remise', 'discount', 'disc', 'lever']) || '',
            unit:     findPropId(['eenheid', 'unit', 'maat', 'eeh']) || '',
            brand:    findPropId(['merk', 'brand']) || '',
            packaging:findPropId(['packaging', 'verpakking']) || '',
            minOrder: findPropId(['min', 'minimum']) || '',
            group:    findPropId(['groep', 'group']) || '',
        };

        const itemsToInject = extractedItems.filter((_, i) => selected[i]);
        const pagesToCreate = itemsToInject.map(item => {
            const props: Record<string, unknown> = {};
            props[map.title] = item.title || 'Unknown Item';
            if (map.bruto)    props[map.bruto]    = item.brutoPrice    || 0;
            if (map.discount) props[map.discount] = item.discountPercent || 0;
            if (map.brand    && item.brand)    props[map.brand]    = item.brand;
            if (map.packaging && item.packaging) props[map.packaging] = item.packaging;
            if (map.minOrder  && item.minimumOrder) props[map.minOrder] = item.minimumOrder;
            if (map.group     && item.group)   props[map.group]    = item.group;
            if (map.unit && item.unit) {
                const u = String(item.unit).toLowerCase().trim();
                props[map.unit] =
                    u.includes('stk') || u.includes('stuk') ? 'u-stk'
                    : u === 'm'   ? 'u-m'
                    : u.includes('m2') ? 'u-m2'
                    : u.includes('m3') ? 'u-m3'
                    : u === 'l' || u.includes('liter') ? 'u-l'
                    : u === 'uur'  ? 'u-uur'
                    : u === 'set'  ? 'u-set'
                    : u.includes('kg') ? 'u-kg'
                    : 'u-stk';
            }
            return props;
        });

        store.addPages('db-articles', pagesToCreate);
        setIsProcessing(false);
        reset();
        onClose();
        alert(`Successfully injected ${pagesToCreate.length} articles directly into the global database!`);
    };

    const reset = () => {
        setFile(null);
        setExtractedItems([]);
        setSelected([]);
        setIsDuplicate([]);
    };

    const dupeCount   = isDuplicate.filter(Boolean).length;
    const checkedCount = selected.filter(Boolean).length;
    const hasItems     = extractedItems.length > 0 && !isProcessing;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[720px] border-none bg-white dark:bg-[#0a0a0a] text-black dark:text-white shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-600" />
                        AI PDF Article Extraction
                    </DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        Upload a supplier invoice or quotation PDF. OpenAI will extract line items, quantities, and prices.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 flex flex-col gap-4 max-h-[72vh] overflow-y-auto">

                    {/* Upload Zone */}
                    {!hasItems && !isProcessing && (
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${file ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-neutral-300 dark:border-white/10 hover:border-neutral-400 dark:hover:border-white/20'}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />

                            {file ? (
                                <>
                                    <FileText className="w-10 h-10 text-purple-600 mb-3" />
                                    <h3 className="font-bold text-neutral-900 dark:text-white">{file.name}</h3>
                                    <p className="text-xs text-neutral-500 mt-1">Ready to parse ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); processPDF(); }}
                                        className="mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Bot className="w-4 h-4" /> Analyze Document
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-neutral-400 mb-3" />
                                    <h3 className="font-bold text-neutral-900 dark:text-white mb-1">Drag & drop your PDF here</h3>
                                    <p className="text-xs text-neutral-500">or click to browse from your computer.</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-purple-600">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <h3 className="font-bold text-lg mb-1 dark:text-white">OpenAI is reading the document...</h3>
                            <p className="text-xs text-neutral-500">Extracting tables, line items, and prices natively.</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && !isProcessing && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex gap-3 text-red-600">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div className="text-sm"><span className="font-bold">Extraction Failed:</span> {error}</div>
                        </div>
                    )}

                    {/* Results */}
                    {hasItems && (
                        <div className="flex flex-col gap-3">
                            {/* Header row */}
                            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-2">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                                        <Check className="w-4 h-4" /> {extractedItems.length} items extracted
                                    </h3>
                                    {canDedup && dupeCount > 0 && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                            <Copy className="w-3 h-3" /> {dupeCount} possible duplicate{dupeCount > 1 ? 's' : ''} detected
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => { reset(); }}
                                    className="text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                                >
                                    Reset
                                </button>
                            </div>

                            {/* PRO dedup banner */}
                            {!canDedup && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs text-neutral-500">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Duplicate line detection is a <strong className="text-neutral-700 dark:text-neutral-300">PRO</strong> feature — upgrade to automatically flag items already in this quotation.</span>
                                </div>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto w-full border border-neutral-200 dark:border-white/10 rounded-lg">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="text-xs text-neutral-500 bg-neutral-50 dark:bg-black/40">
                                        <tr>
                                            {canDedup && (
                                                <th className="px-3 py-2 w-8">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.every(Boolean)}
                                                        onChange={toggleAll}
                                                        className="rounded accent-purple-600 cursor-pointer"
                                                        title="Toggle all"
                                                    />
                                                </th>
                                            )}
                                            <th className="px-3 py-2">Item Description</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2">Unit</th>
                                            <th className="px-3 py-2 text-right">Unit Price</th>
                                            {canDedup && <th className="px-3 py-2 text-center w-24">Status</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                        {extractedItems.map((item, idx) => {
                                            const dupe = isDuplicate[idx];
                                            const checked = selected[idx];
                                            return (
                                                <tr
                                                    key={idx}
                                                    onClick={() => canDedup && toggleItem(idx)}
                                                    className={`transition-colors ${canDedup ? 'cursor-pointer' : ''} ${
                                                        canDedup && !checked
                                                            ? 'opacity-50 bg-neutral-50 dark:bg-white/[0.02]'
                                                            : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                                                    }`}
                                                >
                                                    {canDedup && (
                                                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleItem(idx)}
                                                                className="rounded accent-purple-600 cursor-pointer"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 font-medium truncate max-w-[280px]" title={item.title}>
                                                        {item.title}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">{item.quantity ?? 1}</td>
                                                    <td className="px-3 py-2 text-neutral-500">{item.unit ?? '—'}</td>
                                                    <td className="px-3 py-2 text-right">€{(item.brutoPrice || 0).toFixed(2)}</td>
                                                    {canDedup && (
                                                        <td className="px-3 py-2 text-center">
                                                            {dupe ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                                    <Copy className="w-2.5 h-2.5" /> dupe
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                                                    <Check className="w-2.5 h-2.5" /> new
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end mt-2 gap-3">
                                <button
                                    onClick={handleDirectLibraryImport}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Database className="w-4 h-4" />
                                    Bulk Upload {canDedup ? checkedCount : extractedItems.length} to DB
                                </button>
                                <button
                                    onClick={confirmImport}
                                    disabled={canDedup && checkedCount === 0}
                                    className="bg-black text-white dark:bg-white dark:text-black hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm"
                                >
                                    Import {canDedup ? checkedCount : extractedItems.length} Items <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
