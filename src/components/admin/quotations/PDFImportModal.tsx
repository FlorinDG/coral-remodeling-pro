import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/time-tracker/components/ui/dialog';
import { Upload, FileText, Bot, AlertCircle, Check, ArrowRight, Loader2, Database } from 'lucide-react';
import { Block } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';

interface PDFImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (blocks: Block[]) => void;
}

export default function PDFImportModal({ isOpen, onClose, onImportComplete }: PDFImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedItems, setExtractedItems] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setExtractedItems([]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === 'application/pdf') {
                setFile(droppedFile);
                setError(null);
                setExtractedItems([]);
            } else {
                setError("Please upload a valid PDF document.");
            }
        }
    };

    const processPDF = async () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/extract-pdf', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server processing error');

            setExtractedItems(data.articles || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmImport = () => {
        const generatedBlocks: Block[] = extractedItems.map(item => {
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
                calculationType: item.calculationType as any || 'materieel'
            };
        });

        onImportComplete(generatedBlocks);
        // Reset state for next time UI is opened
        setFile(null);
        setExtractedItems([]);
        onClose();
    };

    const handleDirectLibraryImport = () => {
        const store = useDatabaseStore.getState();
        const articleDb = store.getDatabase('db-articles');
        if (!articleDb) {
            setError("Global article database not found.");
            return;
        }

        setIsProcessing(true);

        const findPropId = (keywords: string[]) => {
            return articleDb.properties.find(p => p.name && keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase())))?.id;
        };

        const map = {
            title: findPropId(['naam', 'titel', 'title', 'name', 'artikel', 'code', 'omschrijving']) || 'title',
            bruto: findPropId(['bruto', 'brutoprijs', 'kost', 'prijs', 'price', 'inkoop']) || '',
            discount: findPropId(['korting', 'remise', 'discount', 'disc']) || '',
            unit: findPropId(['eenheid', 'unit', 'maat', 'eeh']) || '',
            brand: findPropId(['merk', 'brand']) || '',
            packaging: findPropId(['packaging', 'verpakking']) || '',
            minOrder: findPropId(['min', 'minimum']) || '',
            group: findPropId(['groep', 'group']) || ''
        };

        const pagesToCreate = extractedItems.map(item => {
            const props: Record<string, any> = {};
            props[map.title] = item.title || 'Unknown Item';
            if (map.bruto) props[map.bruto] = item.brutoPrice || 0;
            if (map.discount) props[map.discount] = item.discountPercent || 0;
            if (map.brand && item.brand) props[map.brand] = item.brand;
            if (map.packaging && item.packaging) props[map.packaging] = item.packaging;
            if (map.minOrder && item.minimumOrder) props[map.minOrder] = item.minimumOrder;
            if (map.group && item.group) props[map.group] = item.group;

            // Map units
            if (map.unit && item.unit) {
                const u = String(item.unit).toLowerCase().trim();
                if (u.includes('stk') || u.includes('stuk')) props[map.unit] = 'u-stk';
                else if (u === 'm') props[map.unit] = 'u-m';
                else if (u.includes('m2')) props[map.unit] = 'u-m2';
                else if (u.includes('m3')) props[map.unit] = 'u-m3';
                else if (u === 'l' || u.includes('liter')) props[map.unit] = 'u-l';
                else if (u === 'uur') props[map.unit] = 'u-uur';
                else if (u === 'set') props[map.unit] = 'u-set';
                else if (u.includes('kg')) props[map.unit] = 'u-kg';
                else props[map.unit] = 'u-stk';
            }
            return props;
        });

        // Add them all instantly to the global memory store!
        store.addPages('db-articles', pagesToCreate);

        setIsProcessing(false);
        setFile(null);
        setExtractedItems([]);
        onClose();
        alert(`Successfully injected ${pagesToCreate.length} articles directly into the global database!`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] border-none bg-white dark:bg-[#0a0a0a] text-black dark:text-white shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-600" />
                        AI PDF Article Extraction
                    </DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500">
                        Upload a supplier invoice or quotation PDF (e.g. Facq, Desco). OpenAI will instantly extract the line items, quantities, and prices.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

                    {/* Upload Zone */}
                    {!extractedItems.length && !isProcessing && (
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${file ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-neutral-300 dark:border-white/10 hover:border-neutral-400 dark:hover:border-white/20'}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="application/pdf"
                                onChange={handleFileChange}
                            />

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

                    {/* Loading State */}
                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-purple-600">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <h3 className="font-bold text-lg mb-1 dark:text-white">OpenAI is reading the document...</h3>
                            <p className="text-xs text-neutral-500">Extracting tables, line items, and prices natively.</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !isProcessing && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex gap-3 text-red-600">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div className="text-sm">
                                <span className="font-bold">Extraction Failed:</span> {error}
                            </div>
                        </div>
                    )}

                    {/* Results Preview */}
                    {extractedItems.length > 0 && !isProcessing && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-2">
                                <h3 className="font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <Check className="w-4 h-4" /> Successfully parsed {extractedItems.length} items
                                </h3>
                                <button
                                    onClick={() => { setExtractedItems([]); setFile(null); }}
                                    className="text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                                >
                                    Reset / Upload Different PDF
                                </button>
                            </div>

                            <div className="overflow-x-auto w-full border border-neutral-200 dark:border-white/10 rounded-lg">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="text-xs text-neutral-500 bg-neutral-50 dark:bg-black/40">
                                        <tr>
                                            <th className="px-3 py-2">Item Description</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2">Unit</th>
                                            <th className="px-3 py-2 text-right">Unit Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                        {extractedItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-white/5">
                                                <td className="px-3 py-2 font-medium truncate max-w-[300px]" title={item.title}>{item.title}</td>
                                                <td className="px-3 py-2 text-right">{item.quantity}</td>
                                                <td className="px-3 py-2 text-neutral-500">{item.unit}</td>
                                                <td className="px-3 py-2 text-right">€{(item.brutoPrice || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end mt-4 gap-3">
                                <button
                                    onClick={handleDirectLibraryImport}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Database className="w-4 h-4" /> Bulk Upload {extractedItems.length} Direct to DB
                                </button>
                                <button
                                    onClick={confirmImport}
                                    className="bg-black text-white dark:bg-white dark:text-black hover:opacity-80 font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    Import {extractedItems.length} Items to Quotation <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
