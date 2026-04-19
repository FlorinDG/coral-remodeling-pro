"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDatabaseStore } from '../store';
import { X, Maximize2, Minimize2, MoreHorizontal, Edit3, Trash2, Plus, Link, ExternalLink, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/time-tracker/components/ui/dropdown-menu';
import { applyRollupAggregation } from '../columns/RollupColumn';
import BlockEditor from './BlockEditor';
import FileManager from '@/components/admin/file-manager/FileManager';
import { useFileManagerStore } from '@/components/admin/file-manager/store';
import PageFinancialAnalysis from './PageFinancialAnalysis';
import VariantsPropertyEditor from './VariantsPropertyEditor';
import { Property, VariantsConfig } from '../types';
import { Search, Loader2, Check } from 'lucide-react';
import DriveFileExplorer from '@/components/admin/drive/DriveFileExplorer';
import { toast } from 'sonner';
import SmartVATLookup from './SmartVATLookup';
import { COLOR_STYLES } from '../columns/SelectColumn';

const PageRollupViewer = ({ databaseId, pageId, property }: { databaseId: string, pageId: string, property: Property }) => {
    const databases = useDatabaseStore(state => state.databases);
    const page = databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId);

    const rollupPropertyId = property.config?.rollupPropertyId;
    const rollupTargetPropertyId = property.config?.rollupTargetPropertyId;

    const aggregatedValues = React.useMemo(() => {
        if (!page || !rollupPropertyId || !rollupTargetPropertyId) return [];
        const relationIds = page.properties?.[rollupPropertyId] as string[];
        if (!relationIds || !Array.isArray(relationIds) || relationIds.length === 0) return [];

        const results: string[] = [];
        for (const targetPageId of relationIds) {
            const targetDb = databases.find(db => db.pages.some(p => p.id === targetPageId));
            if (targetDb) {
                const targetPage = targetDb.pages.find(p => p.id === targetPageId);
                if (targetPage) {
                    const val = targetPage.properties[rollupTargetPropertyId];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        results.push(String(val));
                    }
                }
            }
        }
        return applyRollupAggregation(results, property.config?.rollupAggregation);
    }, [page, rollupPropertyId, rollupTargetPropertyId, databases, property.config?.rollupAggregation]);

    if (aggregatedValues.length === 0) {
        return <div className="w-full h-full flex items-center text-neutral-400 font-medium italic">Empty Rollup</div>;
    }

    return (
        <div className="w-full h-full flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <Search className="w-3 h-3 text-neutral-400 flex-shrink-0 mr-1" />
            {aggregatedValues.map((val: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap">
                    {val}
                </span>
            ))}
        </div>
    );
};

const PageRelationEditor = ({ databaseId, pageId, property }: { databaseId: string, pageId: string, property: Property }) => {
    const targetDbId = property.config?.relationDatabaseId;
    const targetDatabase = useDatabaseStore(state => state.databases.find(db => db.id === targetDbId));
    const page = useDatabaseStore(state => state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    const rawValue = page?.properties[property.id];
    const value = Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue ? [rawValue] : []);

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const listener = (e: MouseEvent | TouchEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, []);

    const displayPropertyId = (property.config as any)?.displayPropertyId || 'title';

    const selectedTitles = React.useMemo(() => {
        if (!targetDatabase || value.length === 0) return [];
        return value.map(id => {
            const dp = targetDatabase.pages.find(p => p.id === id);
            return (dp?.properties[displayPropertyId] as string) || 'Untitled';
        });
    }, [targetDatabase, value, displayPropertyId]);

    const filteredPages = React.useMemo(() => {
        if (!targetDatabase) return [];
        if (!search.trim()) return targetDatabase.pages;
        return targetDatabase.pages.filter(p => {
            const title = String(p.properties[displayPropertyId] || 'Untitled');
            return title.toLowerCase().includes(search.toLowerCase());
        });
    }, [targetDatabase, search, displayPropertyId]);

    return (
        <div ref={ref} className="relative w-full h-full flex items-center">
            <div
                className="flex gap-1 overflow-x-auto no-scrollbar outline-none cursor-pointer w-full h-full items-center"
                onClick={() => setIsOpen(true)}
            >
                {selectedTitles.length === 0 ? (
                    <span className="text-neutral-400 placeholder">Empty</span>
                ) : (
                    selectedTitles.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap">
                            <Link className="w-3 h-3" />
                            {t}
                        </span>
                    ))
                )}
            </div>

            {isOpen && ref.current && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[999999] bg-white dark:bg-neutral-900 border border-blue-500 shadow-xl rounded-md w-64 p-2 animate-in fade-in duration-200"
                    style={{
                        top: ref.current.getBoundingClientRect().bottom + 4,
                        left: ref.current.getBoundingClientRect().left
                    }}
                >
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search pages..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border-none outline-none text-sm px-2 py-1.5 rounded mb-2 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                    />

                    {selectedTitles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                            {value.map((id, i) => (
                                <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                    <Link className="w-3 h-3" />
                                    {selectedTitles[i]}
                                    <button
                                        className="ml-1 hover:text-red-500"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updatePageProperty(databaseId, pageId, property.id, value.filter(v => v !== id));
                                        }}
                                    >×</button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {filteredPages.length === 0 && <span className="text-xs text-neutral-400 p-2 italic">No results</span>}
                        {filteredPages.map(p => {
                            const isSelected = value.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        if (isSelected) updatePageProperty(databaseId, pageId, property.id, value.filter(v => v !== p.id));
                                        else updatePageProperty(databaseId, pageId, property.id, [...value, p.id]);
                                    }}
                                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${isSelected ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'}`}
                                >
                                    {String(p.properties[displayPropertyId] || 'Untitled')}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── Premium PropertySelectPicker ──────────────────────────────────────────
const PropertySelectPicker = ({ value, options, onChange }: { value: string; options: any[]; onChange: (v: string) => void }) => {
    const [open, setOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const ref = React.useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.id === value);
    const styles = selected ? (COLOR_STYLES[selected.color] || COLOR_STYLES.gray) : null;

    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            // Close if click is outside the trigger AND outside any portal dropdown
            const target = e.target as Node;
            const inRef = ref.current && ref.current.contains(target);
            const inPortal = (target as Element)?.closest?.('[data-select-portal]');
            if (!inRef && !inPortal) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative w-full">
            <button
                onClick={(e) => {
                    if (!open) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                    }
                    setOpen(!open);
                }}
                className="flex items-center gap-2 w-full text-left group"
            >
                {selected && styles ? (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${styles.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} flex-shrink-0`} />
                        {selected.name}
                    </span>
                ) : (
                    <span className="text-neutral-400 text-sm italic">Empty</span>
                )}
                <ChevronDown className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    data-select-portal
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    className="fixed z-[999999] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-100 dark:border-neutral-700/80 py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
                >
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
                        onClick={() => { onChange(''); setOpen(false); }}
                    >
                        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            {!value && <Check className="w-3 h-3 text-neutral-400" />}
                        </span>
                        <span className="text-xs text-neutral-400 italic font-medium">Empty</span>
                    </button>
                    <div className="h-px bg-neutral-100 dark:bg-neutral-800 mx-2 my-0.5" />
                    {options.map((opt: any) => {
                        const c = COLOR_STYLES[opt.color] || COLOR_STYLES.gray;
                        const isSelected = opt.id === value;
                        return (
                            <button
                                key={opt.id}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${isSelected ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''}`}
                                onClick={() => { onChange(opt.id); setOpen(false); }}
                            >
                                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                    {isSelected && <Check className="w-3 h-3 text-neutral-400" />}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${c.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                                    {opt.name}
                                </span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── Purchase Invoice Paper View ────────────────────────────────────────────
const PurchaseInvoiceSheet = ({ databaseId, pageId }: { databaseId: string; pageId: string }) => {
    const page = useDatabaseStore(state => state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId));
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const supplierDb = useDatabaseStore(state => state.databases.find(db => db.id === 'db-suppliers'));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    if (!page || !database) return null;

    const fmt = (val: any) => {
        if (!val && val !== 0) return '—';
        return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(Number(val));
    };
    const fmtDate = (val: any) => {
        if (!val) return '—';
        try { return new Date(val).toLocaleDateString('fr-BE'); } catch { return String(val); }
    };

    const statusProp = database.properties.find(p => p.id === 'status');
    const statusOpt = statusProp?.config?.options?.find((o: any) => o.id === page.properties['status']);
    const statusStyles = statusOpt ? (COLOR_STYLES[statusOpt.color] || COLOR_STYLES.gray) : null;

    const sourceProp = database.properties.find(p => p.id === 'source');
    const sourceOpt = sourceProp?.config?.options?.find((o: any) => o.id === page.properties['source']);

    const supplierIds = page.properties['supplier'] as string[] | undefined;
    const supplierId = Array.isArray(supplierIds) ? supplierIds[0] : undefined;
    const supplierPage = supplierId ? supplierDb?.pages.find(p => p.id === supplierId) : undefined;
    const supplierName = supplierPage ? String(supplierPage.properties['title'] || '') : '';

    const totalExVat = page.properties['totalExVat'];
    const totalVat = page.properties['totalVat'];
    const totalIncVat = page.properties['totalIncVat'];
    const description = page.properties['betreft'];
    const invoiceDate = page.properties['invoiceDate'];
    const dueDate = page.properties['dueDate'];
    const peppolDocId = page.properties['peppolDocId'];

    // Parse stored Peppol line items
    let lines: Array<{ description: string; quantity: number; unitCode: string; unitPrice: number; vatRate: number; lineTotal: number }> = [];
    try {
        const raw = page.properties['invoiceLines'];
        if (raw && typeof raw === 'string') lines = JSON.parse(raw);
    } catch { /* no lines */ }

    return (
        <div className="mt-6 mb-8 max-w-3xl">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/60 rounded-2xl shadow-sm overflow-hidden">
                {/* Header band */}
                <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-1">
                            {sourceOpt ? sourceOpt.name : 'Purchase Invoice'}
                        </p>
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                            {String(page.properties['title'] || 'Untitled')}
                        </h2>
                        {supplierName && (
                            <p className="text-sm text-neutral-500 mt-1 font-medium">{supplierName}</p>
                        )}
                        {peppolDocId && (
                            <p className="text-xs text-neutral-400 mt-0.5 font-mono">{String(peppolDocId)}</p>
                        )}
                    </div>
                    {statusOpt && statusStyles && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusStyles.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyles.dot}`} />
                            {statusOpt.name}
                        </span>
                    )}
                </div>

                {/* Date row */}
                <div className="grid grid-cols-2 gap-0 divide-x divide-neutral-100 dark:divide-neutral-800 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="px-8 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">Invoice Date</p>
                        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{fmtDate(invoiceDate)}</p>
                    </div>
                    <div className="px-8 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">Due Date</p>
                        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{fmtDate(dueDate)}</p>
                    </div>
                </div>

                {/* Description (only when no line items) */}
                {description && lines.length === 0 && (
                    <div className="px-8 py-4 border-b border-neutral-100 dark:border-neutral-800">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Description</p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300">{String(description)}</p>
                    </div>
                )}

                {/* Line items table (Peppol / parsed invoices) */}
                {lines.length > 0 && (
                    <div className="border-b border-neutral-100 dark:border-neutral-800">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                                    <th className="text-left px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Description</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 whitespace-nowrap">Qty</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 whitespace-nowrap">Unit Price</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 whitespace-nowrap">VAT %</th>
                                    <th className="text-right px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 whitespace-nowrap">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {lines.map((line, i) => (
                                    <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                                        <td className="px-8 py-3 text-neutral-700 dark:text-neutral-300 font-medium">{line.description || '—'}</td>
                                        <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400 tabular-nums">
                                            {line.quantity} <span className="text-neutral-400">{line.unitCode}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400 tabular-nums">{fmt(line.unitPrice)}</td>
                                        <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400 tabular-nums">{line.vatRate}%</td>
                                        <td className="px-8 py-3 text-right font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{fmt(line.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Totals */}
                <div className="px-8 py-6">
                    <div className="space-y-2 max-w-xs ml-auto">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-neutral-500">Total Excl. VAT</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{fmt(totalExVat)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-neutral-500">VAT</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{fmt(totalVat)}</span>
                        </div>
                        <div className="h-px bg-neutral-200 dark:bg-neutral-700 my-3" />
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">Total Incl. VAT</span>
                            <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">{fmt(totalIncVat)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PageModalProps {
    databaseId: string;
    pageId: string;
    onClose: () => void;
}

export default function PageModal({ databaseId, pageId, onClose }: PageModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [width, setWidth] = useState(1200);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = width;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = startX - moveEvent.pageX;
            setWidth(Math.max(600, Math.min(window.innerWidth, startWidth + deltaX)));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const deleteProperty = useDatabaseStore(state => state.deleteProperty);
    const page = database?.pages.find(p => p.id === pageId);

    // We get the specific action initialized previously
    const initializeContextFolder = useFileManagerStore(state => state.initializeContextFolder);

    // Auto-create a Google Drive folder if this page doesn't have one yet
    React.useEffect(() => {
        const createDriveFolder = async () => {
            if (page && !page.properties['driveFolderId'] && page.properties['title']) {
                const folderName = String(page.properties['title']);

                // We use 'project' arbitrarily here, but ideally we'd pass a more specific contextType if needed
                const driveId = await initializeContextFolder(folderName, 'project', page.id);

                if (driveId) {
                    // Save the new folder ID back into the Database Page record properly
                    updatePageProperty(databaseId, page.id, 'driveFolderId', driveId);
                }
            }
        };

        createDriveFolder();
    }, [page?.id, page?.properties, databaseId, initializeContextFolder, updatePageProperty]);

    // Garbage collection script to prune the mass-cloned Google Drive folders created by the previous infinite loop bug
    const { nodes, deleteNode } = useFileManagerStore();
    React.useEffect(() => {
        if (!database || !page) return;

        // Start async sweep to respect Google API rate limits
        const startGarbageCollection = async () => {
            // Find all project folders generated for this specific page
            const duplicateFolders = nodes.filter(n => n.contextType === 'project' && n.contextId === page.id && n.type === 'folder');

            // If we have clones
            if (duplicateFolders.length > 1) {
                // Determine the "True" folder ID. Either the one actively bound to the page, or the newest one if none bound.
                const boundDriveId = page.driveFolderId || page.properties['driveFolderId'] || duplicateFolders[duplicateFolders.length - 1].id;

                // Identify all orphans
                const orphans = duplicateFolders.filter(f => f.id !== boundDriveId);

                console.log(`[Garbage Collector] Commencing purge of ${orphans.length} cloned Drive folders for ${page.id}...`);
                for (const orphan of orphans) {
                    try {
                        console.log(`[Garbage Collector] Purging node ${orphan.id}...`);
                        await deleteNode(orphan.id);
                        // Mandatory 500ms sleep to prevent Google Drive API HTTP 429 Rate Limiting crashes
                        await new Promise(r => setTimeout(r, 500));
                    } catch (e) {
                        console.error(`[Garbage Collector] Failed to delete ${orphan.id}:`, e);
                    }
                }
                console.log(`[Garbage Collector] Purge complete!`);
            }
        };

        startGarbageCollection();
    }, [database, page, nodes, deleteNode]);

    const handleVATImport = (data: { name: string; address: string; vatNumber: string }) => {
        if (data.name) updatePageProperty(databaseId, pageId, 'title', data.name);

        // Find various address-related properties and populate them
        const findProp = (match: string) => database?.properties.find(p =>
            p.id === match || p.name.toLowerCase() === match.toLowerCase()
        );

        // Full address field
        const addressProp = database?.properties.find(p =>
            p.name.toLowerCase().includes('address') || p.name.toLowerCase().includes('adres') || p.id === 'prop-address-main' || p.id === 'address'
        );
        if (data.address && addressProp) {
            // VIES returns address like "RUE EXAMPLE 123\n1000 BRUXELLES" — try to parse
            const lines = data.address.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
            if (lines.length >= 2) {
                // First line is usually street, last line is usually "postal city"
                const streetLine = lines[0];
                const lastLine = lines[lines.length - 1];

                updatePageProperty(databaseId, pageId, addressProp.id, streetLine);

                // Try to extract postal code and city from last line (e.g., "1000 BRUXELLES")
                const postalMatch = lastLine.match(/^(\d{4,5})\s+(.+)$/);
                const cityProp = findProp('city');
                const postalProp = findProp('postal') || findProp('Postal Code');
                const countryProp = findProp('country');

                if (postalMatch) {
                    if (postalProp) updatePageProperty(databaseId, pageId, postalProp.id, postalMatch[1]);
                    if (cityProp) updatePageProperty(databaseId, pageId, cityProp.id, postalMatch[2]);
                } else {
                    if (cityProp) updatePageProperty(databaseId, pageId, cityProp.id, lastLine);
                }

                if (countryProp && data.vatNumber) {
                    // Extract country from VAT prefix (e.g., "BE" from "BE0848970428")
                    const cc = data.vatNumber.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase();
                    const countryMap: Record<string, string> = { BE: 'Belgium', NL: 'Netherlands', FR: 'France', DE: 'Germany', LU: 'Luxembourg' };
                    updatePageProperty(databaseId, pageId, countryProp.id, countryMap[cc] || cc);
                }
            } else {
                updatePageProperty(databaseId, pageId, addressProp.id, data.address);
            }
        }

        // Also populate the company name prop if it exists separately
        const companyProp = findProp('company');
        if (data.name && companyProp) updatePageProperty(databaseId, pageId, companyProp.id, data.name);

        toast.success('Bedrijfsgegevens geïmporteerd uit VIES register.', { id: 'vat-import' });
    };

    if (!database || !page) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div
                className={`relative h-full bg-white dark:bg-[#191919] shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300 flex-shrink-0 ${isMaximized ? 'w-full' : ''}`}
                style={isMaximized ? {} : { width: `${width}px` }}
            >
                {!isMaximized && (
                    <div
                        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-[110]"
                        onMouseDown={handleMouseDown}
                    />
                )}

                {/* Header Actions */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        >
                            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Page Content */}
                <div className="flex-1 px-8 pt-2 pb-6 max-w-[1200px] mx-auto w-full">
                    {/* Title */}
                    <input
                        className="w-full text-4xl font-bold mb-4 text-neutral-900 dark:text-white outline-none bg-transparent placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
                        value={(page.properties['title'] as string) || ''}
                        onChange={(e) => updatePageProperty(databaseId, pageId, 'title', e.target.value)}
                        placeholder="Untitled"
                    />

                    {/* Properties Grid */}
                    {/* Properties Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[1px] bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden mb-8">
                        {database.properties.filter(p => p.id !== 'title').map(prop => (
                            <div key={prop.id} className="flex flex-col justify-center gap-1 px-3 py-2 bg-neutral-50 dark:bg-[#151515] hover:bg-white dark:hover:bg-[#1e1e1e] transition-colors group relative">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-neutral-500 dark:text-neutral-500 font-bold uppercase tracking-wider">{prop.name}</span>
                                    </div>

                                    {(prop.type === 'select' || prop.type === 'multi_select') && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-0.5 -mr-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="w-3 h-3" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 z-[110] shadow-xl">
                                                <DropdownMenuItem onClick={() => {
                                                    const newName = prompt('Enter new property name:', prop.name);
                                                    if (newName) {
                                                        useDatabaseStore.getState().updateProperty(databaseId, prop.id, { name: newName });
                                                    }
                                                }} className="cursor-pointer">
                                                    <Edit3 className="w-4 h-4 mr-2" />
                                                    Rename Property
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => {
                                                    const optName = prompt('Add new option:');
                                                    if (optName) {
                                                        const newOpt = { id: Math.random().toString(36).substring(7), name: optName, color: 'blue' };
                                                        const newOptions = [...(prop.config?.options || []), newOpt];
                                                        useDatabaseStore.getState().updateProperty(databaseId, prop.id, { config: { ...prop.config, options: newOptions } });
                                                    }
                                                }} className="cursor-pointer">
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Option
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => {
                                                    if (confirm(`Are you sure you want to delete property "${prop.name}"?`)) {
                                                        useDatabaseStore.getState().deleteProperty(databaseId, prop.id);
                                                    }
                                                }} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete Property
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 min-h-[32px] py-1 flex items-center w-full">
                                    {(prop.id === 'prop-vat-number' || prop.name.toLowerCase() === 'btw' || prop.name.toLowerCase() === 'vat number' || prop.name.toLowerCase() === 'btw nummer') ? (
                                        <SmartVATLookup
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(val) => updatePageProperty(databaseId, pageId, prop.id, val)}
                                            onImport={handleVATImport}
                                        />
                                    ) : prop.type === 'text' ? (
                                        <textarea
                                            className="w-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium resize-none overflow-hidden leading-tight"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                updatePageProperty(databaseId, pageId, prop.id, e.target.value);
                                            }}
                                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                            rows={1}
                                            placeholder="Empty"
                                        />
                                    ) : prop.type === 'number' ? (
                                        <input
                                            type="number"
                                            className="w-full h-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium"
                                            value={(page.properties[prop.id] as number) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, parseFloat(e.target.value))}
                                            placeholder="0"
                                        />
                                    ) : prop.type === 'date' ? (
                                        <input
                                            type="date"
                                            className="w-full h-full bg-transparent outline-none cursor-pointer text-neutral-700 dark:text-neutral-300 font-medium"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                        />
                                    ) : prop.type === 'checkbox' ? (
                                        <label className="flex items-center gap-2 w-full h-full cursor-pointer group/label">
                                            <input
                                                type="checkbox"
                                                checked={(page.properties[prop.id] as boolean) || false}
                                                onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.checked)}
                                                className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                                            />
                                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 select-none group-hover/label:text-neutral-900 dark:group-hover/label:text-neutral-200 transition-colors">
                                                {page.properties[prop.id] ? "Done" : "Pending"}
                                            </span>
                                        </label>
                                    ) : prop.type === 'select' ? (
                                        <PropertySelectPicker
                                            value={(page.properties[prop.id] as string) || ''}
                                            options={prop.config?.options || []}
                                            onChange={(v) => updatePageProperty(databaseId, pageId, prop.id, v)}
                                        />
                                    ) : prop.type === 'multi_select' ? (
                                        <textarea
                                            className="w-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium resize-none overflow-hidden leading-tight"
                                            value={Array.isArray(page.properties[prop.id]) ? (page.properties[prop.id] as string[]).join(', ') : ''}
                                            onChange={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                const val = e.target.value;
                                                const arr = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                updatePageProperty(databaseId, pageId, prop.id, arr);
                                            }}
                                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                            rows={1}
                                            placeholder="Comma separated..."
                                        />
                                    ) : prop.type === 'relation' ? (
                                        <PageRelationEditor databaseId={databaseId} pageId={pageId} property={prop} />
                                    ) : prop.type === 'rollup' ? (
                                        <PageRollupViewer databaseId={databaseId} pageId={pageId} property={prop} />
                                    ) : prop.type === 'variants' ? (
                                        <VariantsPropertyEditor
                                            databaseId={databaseId}
                                            pageId={pageId}
                                            propertyId={prop.id}
                                            initialConfig={(page.properties[prop.id] as VariantsConfig) || []}
                                        />
                                    ) : ['email', 'phone', 'url', 'places'].includes(prop.type) ? (
                                        <div className="flex items-center w-full gap-2 group relative">
                                            <textarea
                                                className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium resize-none overflow-hidden leading-tight"
                                                value={page.properties[prop.id] !== undefined ? String(page.properties[prop.id]) : ''}
                                                onChange={(e) => {
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                    updatePageProperty(databaseId, pageId, prop.id, e.target.value);
                                                }}
                                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                rows={1}
                                                placeholder={`Empty (${prop.type})`}
                                            />
                                            {page.properties[prop.id] && String(page.properties[prop.id]).trim() !== '' && (
                                                <a
                                                    href={
                                                        prop.type === 'email' ? `mailto:${page.properties[prop.id]}` :
                                                            prop.type === 'phone' ? `tel:${String(page.properties[prop.id]).replace(/[^\d+]/g, '')}` :
                                                                prop.type === 'places' ? `https://maps.google.com/?q=${encodeURIComponent(String(page.properties[prop.id]))}` :
                                                                    prop.type === 'url' ? (String(page.properties[prop.id]).startsWith('http') ? String(page.properties[prop.id]) : `https://${page.properties[prop.id]}`) :
                                                                        '#'
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition flex-shrink-0 text-blue-500 hover:text-blue-600 dark:text-blue-400"
                                                    title={`Open ${prop.type}`}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <textarea
                                            className="w-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium resize-none overflow-hidden leading-tight"
                                            value={page.properties[prop.id] !== undefined ? String(page.properties[prop.id]) : ''}
                                            onChange={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                updatePageProperty(databaseId, pageId, prop.id, e.target.value);
                                            }}
                                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                            rows={1}
                                            placeholder={`Empty (${prop.type})`}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Financial Analysis Inline Component */}
                    <div className="px-6 md:px-0">
                        <PageFinancialAnalysis databaseId={databaseId} pageId={pageId} />
                    </div>

                    {/* Content / Invoice Preview */}
                    <div className="mt-8 mb-12 px-6 md:px-0">
                        {databaseId === 'db-expenses' ? (
                            <PurchaseInvoiceSheet databaseId={databaseId} pageId={pageId} />
                        ) : (
                            <BlockEditor databaseId={databaseId} pageId={pageId} />
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
