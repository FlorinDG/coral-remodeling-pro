import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/time-tracker/components/ui/dialog';
import { Upload, FileText, Bot, AlertCircle, Check, ArrowRight, Loader2, Database, ClipboardList } from 'lucide-react';
import { Block } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';

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
    vatRate?: number;
    totalPrice?: number;
}

interface ExtractedMetadata {
    vendorName?: string;
    vendorVat?: string;
    vendorAddress?: string;
    customerName?: string;
    customerVat?: string;
    documentRef?: string;
    documentDate?: string;
    grandTotalExcl?: number;
    grandTotalIncl?: number;
    vatAmount?: number;
    vatRate?: number;
    currency?: string;
}

interface PDFImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (blocks: Block[]) => void;
    /** Callback to auto-fill invoice page properties from extracted metadata */
    onMetadataExtracted?: (metadata: ExtractedMetadata) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PDFImportModal({
    isOpen,
    onClose,
    onImportComplete,
    onMetadataExtracted,
}: PDFImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [docType, setDocType] = useState<'supplier' | 'meetstaat' | 'other'>('supplier');
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [extractedMeta, setExtractedMeta] = useState<ExtractedMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setExtractedItems([]);
            setExtractedMeta(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile?.type === 'application/pdf') {
            setFile(droppedFile);
            setError(null);
            setExtractedItems([]);
            setExtractedMeta(null);
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
        formData.append('docType', docType);

        try {
            // Use the unified AI parse endpoint (same as quotation import)
            const res = await fetch('/api/integrations/parse-pdf', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server processing error');

            const items: ExtractedItem[] = (data.articles || data.data || []).map((item: any) => ({
                title: item.title || item.Title || '',
                brutoPrice: item.brutoPrice || item.UnitPrice || 0,
                discountPercent: item.discountPercent || item.Discount || 0,
                quantity: item.quantity || item.Quantity || 1,
                unit: item.unit || item.Unit || 'stk',
                brand: item.brand || item.Brand || '',
                group: item.group || item.Section || '',
                calculationType: item.calculationType || undefined,
                vatRate: item.vatRate || item.VatRate || undefined,
                totalPrice: item.totalPrice || item.TotalPrice || undefined,
            }));

            // Extract document metadata
            const meta: ExtractedMetadata = data.metadata || {};
            setExtractedMeta(meta);
            setExtractedItems(items);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Extraction failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmImport = () => {
        const generatedBlocks: Block[] = extractedItems.map(item => ({
            id: crypto.randomUUID(),
            type: 'line' as const,
            content: item.title || 'Unknown Item',
            brutoPrice: item.brutoPrice || 0,
            discountPercent: item.discountPercent || 0,
            quantity: item.quantity || 1,
            unit: item.unit || 'stk',
            unitPrice: item.brutoPrice || 0,
            calculationType: (item.calculationType as Block['calculationType']) || 'materieel',
        }));

        // Auto-fill invoice page properties from extracted metadata
        if (onMetadataExtracted && extractedMeta) {
            onMetadataExtracted(extractedMeta);
        }

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

        const pagesToCreate = extractedItems.map(item => {
            const props: Record<string, any> = {};
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
        setExtractedMeta(null);
    };

    const hasItems = extractedItems.length > 0 && !isProcessing;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[720px] border-none bg-white dark:bg-[#0a0a0a] text-black dark:text-white shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-600" />
                        AI Document Import
                    </DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        Upload a supplier PDF, meetstaat, or invoice. AI will extract document info, line items, quantities, and prices.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 flex flex-col gap-4 max-h-[72vh] overflow-y-auto">

                    {/* Document type selector */}
                    {!hasItems && !isProcessing && (
                        <div className="flex gap-2">
                            {[
                                { id: 'supplier' as const, label: 'Leverancier PDF', desc: 'Factuur / offerte van leverancier', icon: FileText, color: 'purple' },
                                { id: 'meetstaat' as const, label: 'Meetstaat', desc: 'Bill of Quantities (hoeveelheden)', icon: ClipboardList, color: 'blue' },
                                { id: 'other' as const, label: 'Ander', desc: 'Vrij document met prijzen', icon: Upload, color: 'gray' },
                            ].map(opt => {
                                const isActive = docType === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => setDocType(opt.id)}
                                        className={`flex-1 p-3 rounded-xl text-left transition-all border ${
                                            isActive
                                                ? `border-${opt.color}-400 dark:border-${opt.color}-500/40 bg-${opt.color}-50 dark:bg-${opt.color}-500/10`
                                                : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <opt.icon className={`w-4 h-4 ${
                                                isActive ? `text-${opt.color}-600 dark:text-${opt.color}-400` : 'text-neutral-400'
                                            }`} />
                                            <span className={`text-xs font-bold ${
                                                isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'
                                            }`}>{opt.label}</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-500 leading-tight">{opt.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

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
                            <p className="text-xs text-neutral-500">Extracting document info, tables, line items, and prices.</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && !isProcessing && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex gap-3 text-red-600">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div className="text-sm">
                                <span className="font-bold">Extraction Failed:</span> {error}
                                {(error.includes('PRO and ENTERPRISE') || error.includes('scan limit')) && (
                                    <div className="mt-2">
                                        <a
                                            href="/admin/settings/billing"
                                            onClick={() => onClose()}
                                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition-colors"
                                        >
                                            Upgrade Plan <ArrowRight className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {hasItems && (
                        <div className="flex flex-col gap-3">
                            {/* Header row */}
                            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-2">
                                <h3 className="font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <Check className="w-4 h-4" /> {extractedItems.length} items extracted
                                </h3>
                                <button
                                    onClick={() => { reset(); }}
                                    className="text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                                >
                                    Reset
                                </button>
                            </div>

                            {/* Document Metadata Banner */}
                            {extractedMeta && (extractedMeta.documentRef || extractedMeta.vendorName || extractedMeta.grandTotalIncl != null) && (
                                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-700/30 rounded-lg p-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                    {extractedMeta.documentRef && (
                                        <div><span className="font-bold text-neutral-500">Document #:</span> <span className="text-neutral-900 dark:text-white font-medium">{extractedMeta.documentRef}</span></div>
                                    )}
                                    {extractedMeta.vendorName && (
                                        <div><span className="font-bold text-neutral-500">Vendor:</span> <span className="text-neutral-900 dark:text-white font-medium">{extractedMeta.vendorName}</span></div>
                                    )}
                                    {extractedMeta.customerName && (
                                        <div><span className="font-bold text-neutral-500">Client:</span> <span className="text-neutral-900 dark:text-white font-medium">{extractedMeta.customerName}</span></div>
                                    )}
                                    {extractedMeta.documentDate && (
                                        <div><span className="font-bold text-neutral-500">Date:</span> <span className="text-neutral-900 dark:text-white font-medium">{extractedMeta.documentDate}</span></div>
                                    )}
                                    {extractedMeta.grandTotalExcl != null && (
                                        <div><span className="font-bold text-neutral-500">Total excl. VAT:</span> <span className="text-neutral-900 dark:text-white font-medium">€{extractedMeta.grandTotalExcl.toFixed(2)}</span></div>
                                    )}
                                    {extractedMeta.grandTotalIncl != null && (
                                        <div><span className="font-bold text-neutral-500">Total incl. VAT:</span> <span className="text-neutral-900 dark:text-white font-medium">€{extractedMeta.grandTotalIncl.toFixed(2)}</span></div>
                                    )}
                                    {extractedMeta.vatAmount != null && (
                                        <div><span className="font-bold text-neutral-500">VAT:</span> <span className="text-neutral-900 dark:text-white font-medium">€{extractedMeta.vatAmount.toFixed(2)}</span></div>
                                    )}
                                    {extractedMeta.vendorVat && (
                                        <div><span className="font-bold text-neutral-500">Vendor VAT:</span> <span className="text-neutral-900 dark:text-white font-medium">{extractedMeta.vendorVat}</span></div>
                                    )}
                                </div>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto w-full border border-neutral-200 dark:border-white/10 rounded-lg">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="text-xs text-neutral-500 bg-neutral-50 dark:bg-black/40">
                                        <tr>
                                            <th className="px-3 py-2">Item Description</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2">Unit</th>
                                            <th className="px-3 py-2 text-right">Unit Price</th>
                                            <th className="px-3 py-2 text-right">VAT %</th>
                                            <th className="px-3 py-2 text-right">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                        {extractedItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-white/5">
                                                <td className="px-3 py-2 font-medium truncate max-w-[280px]" title={item.title}>{item.title}</td>
                                                <td className="px-3 py-2 text-right">{item.quantity ?? 1}</td>
                                                <td className="px-3 py-2 text-neutral-500">{item.unit ?? '—'}</td>
                                                <td className="px-3 py-2 text-right">€{(item.brutoPrice || 0).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right text-neutral-500">{item.vatRate != null ? `${item.vatRate}%` : '—'}</td>
                                                <td className="px-3 py-2 text-right font-medium">€{(item.totalPrice ?? ((item.brutoPrice || 0) * (item.quantity || 1))).toFixed(2)}</td>
                                            </tr>
                                        ))}
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
                                    Bulk Upload {extractedItems.length} to DB
                                </button>
                                <button
                                    onClick={confirmImport}
                                    className="bg-black text-white dark:bg-white dark:text-black hover:opacity-80 font-bold py-2 px-5 rounded-lg transition-colors flex items-center gap-2 text-sm"
                                >
                                    Import {extractedItems.length} Items <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
