import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/time-tracker/components/ui/dialog';
import { Upload, FileSpreadsheet, Bot, AlertCircle, Check, ArrowRight, Loader2, Database, TableProperties } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';

interface SpreadsheetImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SpreadsheetImportModal({ isOpen, onClose }: SpreadsheetImportModalProps) {
    const defaultGlobalDb = 'db-articles';
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Parsed File State
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewData, setPreviewData] = useState<any[]>([]);

    // Mapping State: { [csvHeaderName]: targetDatabasePropertyId }
    const [mapping, setMapping] = useState<Record<string, string>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Native Zustand Reference
    const store = useDatabaseStore();
    const articleDb = store.getDatabase(defaultGlobalDb);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        setError(null);
        setIsParsing(true);
        setHeaders([]);
        setPreviewData([]);
        setMapping({});

        try {
            const fileName = uploadedFile.name.toLowerCase();

            if (fileName.endsWith('.csv')) {
                // Parse CSV Natively
                Papa.parse(uploadedFile, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const parsedData = results.data as any[];
                        if (parsedData.length === 0) throw new Error("CSV file is empty");

                        const extractedHeaders = results.meta.fields || Object.keys(parsedData[0] || {});
                        setupMapping(extractedHeaders, parsedData);
                    },
                    error: (err) => {
                        throw new Error("CSV Parsing Error: " + err.message);
                    }
                });
            }
            else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                // Parse Excel Natively
                const buffer = await uploadedFile.arrayBuffer();
                const workbook = xlsx.read(buffer, { type: 'array' });

                if (workbook.SheetNames.length === 0) throw new Error("Excel file is empty");

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const parsedData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

                if (parsedData.length === 0) throw new Error("Excel sheet is empty");

                const extractedHeaders = Object.keys(parsedData[0] || {});
                setupMapping(extractedHeaders, parsedData);
            }
            else {
                throw new Error("Unsupported file format. Please upload .csv or .xlsx");
            }

        } catch (e: any) {
            setError(e.message || "Failed to parse spreadsheet file");
            setFile(null);
            setIsParsing(false);
        }
    };

    const setupMapping = (extractedHeaders: string[], data: any[]) => {
        setHeaders(extractedHeaders);
        setPreviewData(data);

        // Auto-detect mappings based on header name heuristics
        const initialMapping: Record<string, string> = {};
        extractedHeaders.forEach(header => {
            const matchId = autoDetectProperty(header);
            if (matchId) {
                initialMapping[header] = matchId;
            } else {
                initialMapping[header] = 'ignore';
            }
        });

        setMapping(initialMapping);
        setIsParsing(false);
    };

    const autoDetectProperty = (headerName: string) => {
        if (!articleDb) return null;
        const normalized = headerName.toLowerCase().trim();

        const map = {
            title: ['naam', 'titel', 'title', 'name', 'artikel', 'code', 'omschrijving', 'description'],
            bruto: ['bruto', 'brutoprijs', 'kost', 'prijs', 'price', 'inkoop', 'excl'],
            discount: ['korting', 'remise', 'discount', 'disc'],
            unit: ['eenheid', 'unit', 'maat', 'eeh'],
            brand: ['merk', 'brand', 'fabricant', 'manufacturer'],
            packaging: ['packaging', 'verpakking', 'colis'],
            minOrder: ['min', 'minimum', 'moq'],
            group: ['groep', 'group', 'categorie', 'category']
        };

        const findPropId = (keywords: string[]) =>
            articleDb.properties.find(p => p.name && keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase())))?.id;

        for (const [key, keywords] of Object.entries(map)) {
            if (keywords.some(k => normalized.includes(k))) {
                return findPropId(keywords);
            }
        }
        return null;
    };

    const handleMappingChange = (header: string, propertyId: string) => {
        setMapping(prev => ({
            ...prev,
            [header]: propertyId
        }));
    };

    const confirmImport = () => {
        if (!articleDb) {
            setError("Global Database schema not found.");
            return;
        }

        setIsProcessing(true);

        // Sequence Tracker for ART-XX-XXXX
        const counters: Record<string, number> = {};

        // Load existing IDs heavily from DB to avoid collision (Optional, naive counting is fine for bulk fresh injection)
        articleDb.pages.forEach(p => {
            const idVal = String(p.properties['prop-art-id'] || '');
            const match = idVal.match(/ART-(\d{2})-(\d{4})/);
            if (match) {
                const group = match[1];
                const seq = parseInt(match[2], 10);
                if (!counters[group] || seq > counters[group]) counters[group] = seq;
            }
        });

        // Inverse mapping to know which property ID gets mapped from which header
        const invertedMap: Record<string, string> = {};
        Object.entries(mapping).forEach(([header, targetPropId]) => {
            if (targetPropId !== 'ignore') {
                invertedMap[targetPropId] = header;
            }
        });

        const pagesToCreate = previewData.map(row => {
            const props: Record<string, any> = {};

            // Pluck mapped values from the row
            articleDb.properties.forEach(dbProp => {
                const sourceHeader = invertedMap[dbProp.id];
                if (sourceHeader && row[sourceHeader] !== undefined) {
                    let val = row[sourceHeader];

                    // Specific Type Castings
                    if (dbProp.type === 'number') {
                        // strip currency strings gracefully
                        const numStr = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
                        val = parseFloat(numStr) || 0;
                    }
                    else if (dbProp.type === 'select') {
                        // Clean whitespace
                        val = String(val).trim();

                        // Edge case manual mapping logic: Group Codes
                        if (dbProp.name === 'Artikelgroep') {
                            const lg = val.toLowerCase();
                            if (lg.includes('ruwbouw')) val = 'opt-ruwbouw';
                            else if (lg.includes('afwerking')) val = 'opt-afwerking';
                            else if (lg.includes('elektriciteit') || lg.includes('elec')) val = 'opt-elektriciteit';
                            else if (lg.includes('sanitaire') || lg.includes('sanitair')) val = 'opt-sanitaire';
                            else if (lg.includes('ventilatie') || lg.includes('hvac')) val = 'opt-ventilatie';
                            else if (lg.includes('verwarming')) val = 'opt-verwarming';
                            else val = 'opt-general';
                        }
                    }
                    props[dbProp.id] = val;
                }
            });

            // Enforce default fallback protections
            const titlePropId = articleDb.properties.find(p => p.name === 'Title' || p.name === 'Naam' || p.id === 'title')?.id || 'title';
            if (!props[titlePropId]) props[titlePropId] = 'Unknown Item mapped from CSV';

            // ART-XX-XXXX Generation Loop Component
            const groupPropId = articleDb.properties.find(p => p.name === 'Artikelgroep' || p.id === 'prop-art-group')?.id;
            let groupCode = '00';

            if (groupPropId && props[groupPropId]) {
                const groupVal = props[groupPropId];
                if (groupVal === 'opt-ruwbouw') groupCode = '01';
                else if (groupVal === 'opt-afwerking') groupCode = '02';
                else if (groupVal === 'opt-elektriciteit') groupCode = '03';
                else if (groupVal === 'opt-sanitaire') groupCode = '04';
                else if (groupVal === 'opt-ventilatie') groupCode = '05';
                else if (groupVal === 'opt-verwarming') groupCode = '06';
            }

            if (!counters[groupCode]) counters[groupCode] = 0;
            counters[groupCode]++;

            // Assign explicitly
            const autoIdProp = articleDb.properties.find(p => p.id === 'prop-art-id' || p.name === 'ID')?.id;
            if (autoIdProp) {
                props[autoIdProp] = `ART-${groupCode}-${String(counters[groupCode]).padStart(4, '0')}`;
            }

            return props;
        });

        // Batch Database Commit Event
        useDatabaseStore.getState().addPages(defaultGlobalDb, pagesToCreate);

        setIsProcessing(false);
        alert(`Master Catalog Engine successfully bulk imported ${pagesToCreate.length} structural items directly into PostgreSQL!`);
        handleClose();
    };

    const handleClose = () => {
        setFile(null);
        setHeaders([]);
        setPreviewData([]);
        setMapping({});
        setError(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[700px] border-none bg-white dark:bg-[#0a0a0a] text-black dark:text-white shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 bg-orange-50 dark:bg-orange-950 border-b border-orange-100 dark:border-orange-900 flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-xl flex items-center gap-2 font-bold select-none text-orange-900 dark:text-orange-100">
                            <TableProperties className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            Global Spreadsheet Import Engine
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-orange-700 dark:text-orange-300">
                            Safely map raw offline CSV/Excel catalogs directly into the synchronized PostgreSQL database structure.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto w-full">
                    {/* File Upload State */}
                    {!file && !isParsing && (
                        <div
                            className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950/30 text-orange-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FileSpreadsheet className="w-8 h-8" />
                            </div>
                            <h3 className="font-bold text-lg mb-1 relative">Upload CSV or Excel List</h3>
                            <p className="text-sm text-neutral-500 max-w-sm relative">
                                Upload a massive supplier pricelist natively. Handled client-side securely.
                            </p>
                        </div>
                    )}

                    {isParsing && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-4" />
                            <h3 className="font-bold text-lg mb-1 mt-4 animate-pulse">Running Neural Lexing Logic...</h3>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 flex gap-3 text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="flex-1 text-sm font-medium">{error}</div>
                        </div>
                    )}

                    {/* Mapping Interface */}
                    {headers.length > 0 && articleDb && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-neutral-500" />
                                    Property Mapping Interface
                                </h3>
                                <div className="text-xs bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-full font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800">
                                    Detected {previewData.length.toLocaleString()} rows
                                </div>
                            </div>

                            <p className="text-sm text-neutral-500 -mt-2">
                                Align the raw headers extracted from your file (Left) to the native database property fields (Right).
                            </p>

                            <div className="bg-neutral-50 dark:bg-neutral-900/40 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden text-sm w-full">
                                <div className="grid grid-cols-2 bg-neutral-100 dark:bg-neutral-900/80 font-bold border-b border-neutral-200 dark:border-neutral-800">
                                    <div className="p-3 text-neutral-500">Spreadsheet Header</div>
                                    <div className="p-3 text-neutral-500 border-l border-neutral-200 dark:border-neutral-800">Target Global Property</div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto split-scrollbar w-full">
                                    {headers.map((header) => (
                                        <div key={header} className="grid grid-cols-2 w-full border-b border-neutral-200 dark:border-neutral-800/60 last:border-0 hover:bg-neutral-100 dark:hover:bg-neutral-800/30 transition-colors">
                                            <div className="p-3 font-medium text-neutral-900 dark:text-neutral-200 break-words flex items-center truncate">
                                                {header}
                                                <span className="ml-2 text-[10px] text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800 px-1.5 rounded truncate">
                                                    ex: {String(previewData[0]?.[header]).substring(0, 25) || 'n/a'}
                                                </span>
                                            </div>
                                            <div className="p-2 border-l border-neutral-200 dark:border-neutral-800/60 break-words flex items-center overflow-hidden">
                                                <select
                                                    value={mapping[header] || 'ignore'}
                                                    onChange={(e) => handleMappingChange(header, e.target.value)}
                                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded p-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none truncate"
                                                >
                                                    <option value="ignore" className="italic text-neutral-500">❌ Ignore (Skip Data)</option>
                                                    <optgroup label={`Master Database Fields (${defaultGlobalDb})`}>
                                                        {articleDb.properties.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                                        ))}
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                >
                                    Upload different file
                                </button>
                                <button
                                    onClick={confirmImport}
                                    disabled={isProcessing}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Batch Processing {previewData.length} lines...</>
                                    ) : (
                                        <><Database className="w-4 h-4" /> Hard Sync {previewData.length.toLocaleString()} Articles Directly</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
