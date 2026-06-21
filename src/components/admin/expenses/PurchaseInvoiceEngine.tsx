/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Check, XCircle, FileText, Loader2, ExternalLink, ArrowDownToLine, Camera, CheckCircle2, Upload, Trash2 } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import type { Page } from '@/components/admin/database/types';
import { downloadPurchaseInvoicePDF } from '@/components/admin/expenses/PurchaseInvoicePDF';
import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import SelectDropdown from '@/components/admin/database/components/SelectDropdown';

interface PurchaseInvoiceEngineProps {
    pageId: string;
    onClose: () => void;
}

interface InvoiceLine {
    id?: string;
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number;
    vatRate: number;
    lineTotal: number;
    category?: string;
    ledgerAccount?: string;
}

interface ParsedInvoice {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    supplierName: string;
    supplierVat: string;
    supplierAddress: string;
    currency: string;
    lines: InvoiceLine[];
    totalExVat: number;
    totalVat: number;
    totalIncVat: number;
    peppolDocId: string;
}

const STATUS_COLORS: Record<string, string> = {
    'opt-draft': 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    'opt-received': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'opt-unpaid': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'opt-paid': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'opt-overdue': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    'opt-disputed': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const STATUS_LABELS: Record<string, string> = {
    'opt-draft': 'Draft',
    'opt-received': 'Received',
    'opt-unpaid': 'Unpaid',
    'opt-paid': 'Paid',
    'opt-overdue': 'Overdue',
    'opt-disputed': 'Disputed',
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
    'src-peppol': { label: 'Peppol', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300' },
    'src-manual': { label: 'Manual', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
    'src-pdf': { label: 'PDF Import', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300' },
};

// Format ISO date to Belgian dd/MM/yyyy
function formatDateBE(isoDate: string | undefined | null): string {
    if (!isoDate) return '—';
    try {
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return String(isoDate);
        return new Intl.DateTimeFormat('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    } catch {
        return String(isoDate);
    }
}

function calculateHeaderTotalsFromLines(lines: any[]) {
    const totalExVat = lines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
    const totalVat = lines.reduce((sum, line) => sum + ((line.lineTotal || 0) * ((line.vatRate ?? 21) / 100)), 0);
    const totalIncVat = totalExVat + totalVat;
    return {
        totalExVat: String(Math.round(totalExVat * 100) / 100),
        totalVat: String(Math.round(totalVat * 100) / 100),
        totalIncVat: String(Math.round(totalIncVat * 100) / 100),
    };
}

export default function PurchaseInvoiceEngine({ pageId, onClose }: PurchaseInvoiceEngineProps) {
    const { resolveDbId, tenant } = useTenant();
    const locale = useLocale();
    const expensesDbId = resolveDbId('db-expenses');
    const suppliersDbId = resolveDbId('db-suppliers');
    const projectsDbId = resolveDbId('db-1');

    const page = useDatabaseStore(s => {
        const db = s.getDatabase(expensesDbId);
        return db?.pages.find((p: Page) => p.id === pageId);
    });
    const updatePageProperty = useDatabaseStore(s => s.updatePageProperty);
    const suppliersDb = useDatabaseStore(s => s.getDatabase(suppliersDbId));
    const projectsDb = useDatabaseStore(s => s.getDatabase(projectsDbId));

    const [peppolDetail, setPeppolDetail] = useState<ParsedInvoice | null>(null);
    const [loadingPeppol, setLoadingPeppol] = useState(false);
    const [peppolAction, setPeppolAction] = useState<'accept' | 'reject' | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    
    // Approve/Reject workflow
    const [rejectMode, setRejectMode] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [approveLoading, setApproveLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [rightTab, setRightTab] = useState<'preview' | 'attachments'>('preview');

    // PDF Zoom & Pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !pageId) return;

        setUploading(true);
        try {
            const { uploadFileAction } = await import('@/app/actions/files');
            const fd = new FormData();
            fd.append('file', file);
            const result = await uploadFileAction(fd, 'purchase-invoice', pageId);
            if (result.success && result.key) {
                updatePageProperty(expensesDbId, pageId, 'receiptUrl', result.key);
            } else {
                alert('Upload failed: ' + (result.error || 'Unknown error'));
            }
        } catch (err: any) {
            console.error('File upload error:', err);
            alert('Upload failed: ' + (err.message || err));
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveReceipt = () => {
        if (confirm('Weet u zeker dat u dit document wilt ontkoppelen?')) {
            updatePageProperty(expensesDbId, pageId, 'receiptUrl', '');
        }
    };

    // Editable fields for manual/draft invoices
    const [editData, setEditData] = useState({
        title: '',
        supplierName: '',
        supplierVat: '',
        betreft: '',
        ogm: '',
        contact: '',
        invoiceDate: '',
        dueDate: '',
        totalExVat: '',
        totalVat: '',
        totalIncVat: '',
        lines: [] as any[],
        deliveryDate: '',
        ourRef: '',
        currency: '',
        vatRegime: '',
        category: '',
        ledgerAccount: '',
        notes: '',
        paidDate: '',
        paymentMethod: '',
        project: [] as string[],
    });

    useEffect(() => {
        if (page) {
            let lines = page.blocks?.filter((b: any) => b.type === 'financial-row').map((b: any) => ({
                id: b.id,
                description: String(b.content || ''),
                quantity: Number(b.properties?.quantity || 0),
                unitCode: String(b.properties?.unitCode || 'C62'),
                unitPrice: Number(b.properties?.unitPrice || 0),
                vatRate: Number(b.properties?.vatRate || 0),
                lineTotal: Number(b.properties?.lineTotal || 0),
                category: String(b.properties?.category || ''),
                ledgerAccount: String(b.properties?.ledgerAccount || ''),
            })) || [];

            if (lines.length === 0 && peppolDetail?.lines) {
                lines = peppolDetail.lines.map((l: any, i: number) => ({
                    id: `temp-${i}`,
                    description: l.description || l.name || '',
                    quantity: l.quantity || 0,
                    unitCode: l.unitCode || 'C62',
                    unitPrice: l.unitPrice || l.price || 0,
                    vatRate: l.vatRate || 0,
                    lineTotal: l.lineTotal || l.totalExVat || 0,
                    category: '',
                    ledgerAccount: '',
                }));
            }

            let totalExVat = page.properties.totalExVat ? String(page.properties.totalExVat) : '';
            let totalVat = page.properties.totalVat ? String(page.properties.totalVat) : '';
            let totalIncVat = page.properties.totalIncVat ? String(page.properties.totalIncVat) : '';

            if (lines.length > 0) {
                const computed = calculateHeaderTotalsFromLines(lines);
                totalExVat = computed.totalExVat;
                totalVat = computed.totalVat;
                totalIncVat = computed.totalIncVat;
            }

            setEditData({
                title: String(page.properties.title || ''),
                supplierName: String(page.properties.supplierName || ''),
                supplierVat: String(page.properties.supplierVat || ''),
                betreft: String(page.properties.betreft || ''),
                ogm: String(page.properties.ogm || ''),
                contact: String(page.properties.contact || ''),
                invoiceDate: String(page.properties.invoiceDate || ''),
                dueDate: String(page.properties.dueDate || ''),
                totalExVat,
                totalVat,
                totalIncVat,
                lines,
                deliveryDate: String(page.properties.deliveryDate || ''),
                ourRef: String(page.properties.ourRef || ''),
                currency: String(page.properties.currency || ''),
                vatRegime: String(page.properties.vatRegime || ''),
                category: String(page.properties.category || ''),
                ledgerAccount: String(page.properties.ledgerAccount || ''),
                notes: String(page.properties.notes || ''),
                paidDate: String(page.properties.paidDate || ''),
                paymentMethod: String(page.properties.paymentMethod || ''),
                project: Array.isArray(page.properties.project) ? page.properties.project.map(String) : [],
            });

            // If this is a Peppol doc, fetch details
            if (page.properties.source === 'src-peppol' && page.properties.peppolDocId && !peppolDetail && !loadingPeppol) {
                fetchPeppolDetail(String(page.properties.peppolDocId));
            }
        }
    }, [page, peppolDetail]);

    const fetchPeppolDetail = async (docId: string) => {
        setLoadingPeppol(true);
        try {
            const res = await fetch(`/api/peppol/inbox/${docId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.parsed) setPeppolDetail(data.parsed);
            }
        } catch (err) {
            console.error('Failed to fetch Peppol detail:', err);
        }
        setLoadingPeppol(false);
    };

    const handlePeppolAction = async (action: 'accept' | 'reject') => {
        if (!page?.properties.peppolDocId) return;
        setPeppolAction(action);
        try {
            const res = await fetch('/api/peppol/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId: page.properties.peppolDocId, action }),
            });
            if (res.ok) {
                updatePageProperty(expensesDbId, pageId, 'status', action === 'accept' ? 'opt-unpaid' : 'opt-disputed');
            }
        } catch (err) {
            console.error('Peppol action failed:', err);
        }
        setPeppolAction(null);
    };

    const updatePageBlocks = useDatabaseStore(s => s.updatePageBlocks);

    const handleSaveEdit = () => {
        if (!page) return;
        Object.entries(editData).forEach(([key, value]) => {
            if (key === 'lines') return;
            const numericFields = ['totalExVat', 'totalVat', 'totalIncVat'];
            const finalVal = numericFields.includes(key) && value ? parseFloat(value as string) : value;
            updatePageProperty(expensesDbId, pageId, key, finalVal);
        });

        const newBlocks = editData.lines.map((line: any) => ({
            id: line.id && !line.id.startsWith('temp-') ? line.id : `line-${Date.now()}-${Math.random().toString(36).substring(2)}`,
            type: 'financial-row' as any,
            content: line.description,
            properties: {
                quantity: parseFloat(String(line.quantity)) || 0,
                unitCode: line.unitCode || 'C62',
                unitPrice: parseFloat(String(line.unitPrice)) || 0,
                vatRate: parseFloat(String(line.vatRate)) || 0,
                lineTotal: parseFloat(String(line.lineTotal)) || 0,
                category: line.category || '',
                ledgerAccount: line.ledgerAccount || '',
            }
        }));

        const oldBlocks = page.blocks || [];
        const nonFinancialBlocks = oldBlocks.filter((b: any) => b.type !== 'financial-row');
        updatePageBlocks(expensesDbId, pageId, [...nonFinancialBlocks, ...newBlocks]);

        setIsEditing(false);
    };

    const handleMarkPaid = () => {
        updatePageProperty(expensesDbId, pageId, 'status', 'opt-paid');
        const today = new Date().toISOString().slice(0, 10);
        updatePageProperty(expensesDbId, pageId, 'paidDate', today);
    };

    // Universal approve / reject (works for all invoice sources)
    const handleApprove = async () => {
        setApproveLoading(true);
        const isPeppolInvoice = page?.properties.source === 'src-peppol';
        if (isPeppolInvoice && page?.properties.peppolDocId) {
            await handlePeppolAction('accept');
        } else {
            updatePageProperty(expensesDbId, pageId, 'status', 'opt-unpaid');
        }
        setApproveLoading(false);
    };

    const handleRejectConfirm = async () => {
        setApproveLoading(true);
        const isPeppolInvoice = page?.properties.source === 'src-peppol';
        if (isPeppolInvoice && page?.properties.peppolDocId) {
            await handlePeppolAction('reject');
        } else {
            updatePageProperty(expensesDbId, pageId, 'status', 'opt-disputed');
        }
        if (rejectComment.trim()) {
            updatePageProperty(expensesDbId, pageId, 'rejectionNote', rejectComment.trim());
        }
        setRejectMode(false);
        setRejectComment('');
        setApproveLoading(false);
    };

    const handleDownloadXml = async () => {
        if (!page?.properties.peppolDocId) return;
        try {
            const res = await fetch(`/api/peppol/inbox/${page.properties.peppolDocId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.parsed?.rawXml) {
                    const blob = new Blob([data.parsed.rawXml], { type: 'application/xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `peppol-invoice-${page.properties.title || page.properties.peppolDocId}.xml`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    alert('XML content not available');
                }
            } else {
                alert('Could not download XML');
            }
        } catch (err) {
            console.error('Failed to download XML:', err);
        }
    };

    const resolvedSupplier = (() => {
        if (!suppliersDb || !page) return null;
        const relVal = page.properties.supplier;
        if (Array.isArray(relVal) && relVal.length > 0) {
            return suppliersDb.pages.find((p: Page) => p.id === relVal[0]);
        }
        return null;
    })();

    const resolvedProject = (() => {
        if (!projectsDb || !page) return null;
        const relVal = page.properties.project;
        if (Array.isArray(relVal) && relVal.length > 0) {
            return projectsDb.pages.find((p: Page) => p.id === relVal[0]);
        }
        return null;
    })();

    const handleExportPDF = async () => {
        if (!page) return;

        if (page.properties.receiptUrl && typeof page.properties.receiptUrl === 'string') {
            const receiptUrl = page.properties.receiptUrl;
            const u = receiptUrl.startsWith('http') ? receiptUrl : `/api/files/${receiptUrl}`;
            window.open(u, '_blank');
            return;
        }

        setExportingPdf(true);
        try {
            const supplierName = resolvedSupplier
                ? String(resolvedSupplier.properties.title || '')
                : (peppolDetail?.supplierName || '');

            const lines = editData.lines.map((line: any) => ({
                description: line.description || '',
                quantity: Number(line.quantity || 0),
                unitCode: line.unitCode || 'C62',
                unitPrice: Number(line.unitPrice || 0),
                vatRate: Number(line.vatRate || 0),
                lineTotal: Number(line.lineTotal || 0)
            }));

            const buyerAddress = [
                tenant?.street,
                [tenant?.postalCode, tenant?.city].filter(Boolean).join(' '),
                tenant?.country
            ].filter(Boolean).join(', ');

            await downloadPurchaseInvoicePDF({
                buyerName: tenant?.commercialName || tenant?.companyName || 'Coral Remodeling',
                buyerVat: tenant?.vatNumber || '',
                buyerAddress: buyerAddress || '',
                supplierName,
                supplierVat: peppolDetail?.supplierVat || '',
                supplierAddress: peppolDetail?.supplierAddress || '',
                invoiceNumber: String(page.properties.title || 'N/A'),
                invoiceDate: String(page.properties.invoiceDate || ''),
                dueDate: String(page.properties.dueDate || ''),
                currency: '€',
                source: SOURCE_BADGES[page.properties.source as string]?.label,
                lines,
                totalExVat: parseFloat(String(page.properties.totalExVat || 0)),
                totalVat: parseFloat(String(page.properties.totalVat || 0)),
                totalIncVat: parseFloat(String(page.properties.totalIncVat || 0)),
            }, tenant?.brandColor);
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setExportingPdf(false);
        }
    };

    const getOptionsForProperty = (propId: string) => {
        const db = useDatabaseStore.getState().getDatabase(expensesDbId);
        const prop = db?.properties?.find(p => p.id === propId);
        return prop?.config?.options || [];
    };

    const projectOptions = (projectsDb?.pages || []).map(p => ({
        id: p.id,
        name: String(p.properties.title || p.properties.name || p.id),
        color: 'blue' as const
    }));

    if (!page) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center">
                    <p className="text-neutral-500">Invoice not found</p>
                    <button onClick={onClose} className="mt-4 text-sm text-orange-500 hover:underline">Close</button>
                </div>
            </div>
        );
    }

    const source = page.properties.source as string || 'src-manual';
    const status = page.properties.status as string || 'opt-draft';
    const isPeppol = source === 'src-peppol';
    const sourceBadge = SOURCE_BADGES[source] || SOURCE_BADGES['src-manual'];
    const amountDue = status === 'opt-paid' ? 0 : parseFloat(String(page.properties.totalIncVat || 0));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="relative w-full max-w-7xl h-[90vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                {/* Left Pane (Metadata & Lines) */}
                <div className="w-[55%] flex flex-col border-r border-neutral-200 dark:border-white/10 relative bg-white dark:bg-neutral-900">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                                        {page.properties.title || 'Untitled Invoice'}
                                    </h2>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${sourceBadge.color}`}>
                                        {sourceBadge.label}
                                    </span>
                                    {page.properties.docType === 'opt-credit-note' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                            Credit Note
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS['opt-draft']}`}>
                                        {STATUS_LABELS[status] || status}
                                    </span>
                                    {resolvedSupplier && (
                                        <span className="text-xs text-neutral-500">• {String(resolvedSupplier.properties.title)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors shrink-0 xl:hidden block">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Left Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {loadingPeppol && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                                <span className="ml-2 text-sm text-neutral-500">Loading Peppol document...</span>
                            </div>
                        )}

                        {/* Invoice Details */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Factuur Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoField
                                    label="Leverancier"
                                    value={isEditing ? String(editData.supplierName || '') : (resolvedSupplier ? String(resolvedSupplier.properties.title || '') : String(page.properties.supplierName || '') || '—')}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, supplierName: v }))}
                                />
                                <InfoField
                                    label="BTW-nummer leverancier"
                                    value={isEditing ? String(editData.supplierVat || '') : (resolvedSupplier ? String(resolvedSupplier.properties.vatNumber || '') : String(page.properties.supplierVat || peppolDetail?.supplierVat || ''))}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, supplierVat: v }))}
                                />
                                <InfoField
                                    label="Contactpersoon"
                                    value={isEditing ? String(editData.contact || '') : String(page.properties.contact || '') || '—'}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, contact: v }))}
                                />
                                <InfoField
                                    label="OGM / Gestructureerde mededeling"
                                    value={isEditing ? String(editData.ogm || '') : String(page.properties.ogm || '') || '—'}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, ogm: v }))}
                                />
                                <InfoField
                                    label="Omschrijving / Betreft"
                                    value={isEditing ? String(editData.betreft || '') : String(page.properties.betreft || '') || '—'}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, betreft: v }))}
                                />
                                <InfoField
                                    label="Onze Referentie"
                                    value={isEditing ? String(editData.ourRef || '') : String(page.properties.ourRef || '') || '—'}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, ourRef: v }))}
                                />
                                <InfoField
                                    label="Factuurdatum"
                                    value={isEditing ? String(editData.invoiceDate || '') : formatDateBE(String(page.properties.invoiceDate || ''))}
                                    editable={isEditing}
                                    type="date"
                                    onChange={v => setEditData(p => ({ ...p, invoiceDate: v }))}
                                />
                                <InfoField
                                    label="Vervaldatum"
                                    value={isEditing ? String(editData.dueDate || '') : formatDateBE(String(page.properties.dueDate || ''))}
                                    editable={isEditing}
                                    type="date"
                                    onChange={v => setEditData(p => ({ ...p, dueDate: v }))}
                                />
                                <InfoField
                                    label="Leveringsdatum"
                                    value={isEditing ? String(editData.deliveryDate || '') : formatDateBE(String(page.properties.deliveryDate || ''))}
                                    editable={isEditing}
                                    type="date"
                                    onChange={v => setEditData(p => ({ ...p, deliveryDate: v }))}
                                />
                            </div>
                        </div>

                        {/* Project Link */}
                        <div className="space-y-4 pt-4 border-t border-neutral-150 dark:border-white/5">
                            <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Project Koppeling</h3>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Gekoppeld Project</label>
                                {isEditing ? (
                                    <div className="max-w-xs">
                                        <SelectDropdown
                                            value={editData.project[0] || null}
                                            options={projectOptions}
                                            onChange={(val) => setEditData(p => ({ ...p, project: val ? [val] : [] }))}
                                            placeholder="Selecteer een project..."
                                        />
                                    </div>
                                ) : (
                                    resolvedProject ? (
                                        <Link
                                            href={`/${locale}/admin/database/db-1/${resolvedProject.id}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            {String(resolvedProject.properties.title || resolvedProject.properties.name || 'Naamloos Project')}
                                            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                                        </Link>
                                    ) : (
                                        <span className="text-neutral-400 text-sm italic">—</span>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Accounting */}
                        <div className="space-y-4 pt-4 border-t border-neutral-150 dark:border-white/5">
                            <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Boekhouding</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Algemene Categorie</label>
                                    {isEditing ? (
                                        <SelectDropdown
                                            value={editData.category || null}
                                            options={getOptionsForProperty('category')}
                                            onChange={(val) => setEditData(p => ({ ...p, category: val || '' }))}
                                            placeholder="Selecteer categorie..."
                                        />
                                    ) : (
                                        <OptionDisplay value={page.properties.category as string} options={getOptionsForProperty('category')} />
                                    )}
                                </div>
                                <InfoField
                                    label="Grootboekrekening (Standaard)"
                                    value={isEditing ? String(editData.ledgerAccount || '') : String(page.properties.ledgerAccount || '') || '—'}
                                    editable={isEditing}
                                    onChange={v => setEditData(p => ({ ...p, ledgerAccount: v }))}
                                />
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Munteenheid</label>
                                    {isEditing ? (
                                        <SelectDropdown
                                            value={editData.currency || null}
                                            options={getOptionsForProperty('currency')}
                                            onChange={(val) => setEditData(p => ({ ...p, currency: val || '' }))}
                                            placeholder="Selecteer munteenheid..."
                                        />
                                    ) : (
                                        <OptionDisplay value={page.properties.currency as string} options={getOptionsForProperty('currency')} />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">BTW-regime</label>
                                    {isEditing ? (
                                        <SelectDropdown
                                            value={editData.vatRegime || null}
                                            options={getOptionsForProperty('vatRegime')}
                                            onChange={(val) => setEditData(p => ({ ...p, vatRegime: val || '' }))}
                                            placeholder="Selecteer BTW-regime..."
                                        />
                                    ) : (
                                        <OptionDisplay value={page.properties.vatRegime as string} options={getOptionsForProperty('vatRegime')} />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Payment & Notes */}
                        <div className="space-y-4 pt-4 border-t border-neutral-150 dark:border-white/5">
                            <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Betaling & Opmerkingen</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Betaalwijze</label>
                                    {isEditing ? (
                                        <SelectDropdown
                                            value={editData.paymentMethod || null}
                                            options={getOptionsForProperty('paymentMethod')}
                                            onChange={(val) => setEditData(p => ({ ...p, paymentMethod: val || '' }))}
                                            placeholder="Selecteer betaalwijze..."
                                        />
                                    ) : (
                                        <OptionDisplay value={page.properties.paymentMethod as string} options={getOptionsForProperty('paymentMethod')} />
                                    )}
                                </div>
                                <InfoField
                                    label="Betaaldatum"
                                    value={isEditing ? String(editData.paidDate || '') : formatDateBE(String(page.properties.paidDate || ''))}
                                    editable={isEditing}
                                    type="date"
                                    onChange={v => setEditData(p => ({ ...p, paidDate: v }))}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Opmerkingen (intern)</label>
                                {isEditing ? (
                                    <textarea
                                        value={editData.notes}
                                        onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                                        rows={3}
                                        className="w-full px-2.5 py-2 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        placeholder="Voeg interne opmerkingen toe..."
                                    />
                                ) : (
                                    <p className="text-sm text-neutral-900 dark:text-white font-medium whitespace-pre-wrap">{page.properties.notes || '—'}</p>
                                )}
                            </div>
                        </div>

                        {/* Financial summary */}
                        <div className="grid grid-cols-4 divide-x divide-neutral-200 dark:divide-white/10 border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-black/10">
                            <FinancialCell
                                label="Total Excl. VAT"
                                value={(isEditing ? editData.totalExVat : page.properties.totalExExVat || page.properties.totalExVat) as string | number}
                                editable={isEditing && editData.lines.length === 0}
                                onChange={v => setEditData(p => ({ ...p, totalExVat: v }))}
                            />
                            <FinancialCell
                                label="Total VAT"
                                value={(isEditing ? editData.totalVat : page.properties.totalVat) as string | number}
                                editable={isEditing && editData.lines.length === 0}
                                onChange={v => setEditData(p => ({ ...p, totalVat: v }))}
                            />
                            <FinancialCell
                                label="Total Incl. VAT"
                                value={(isEditing ? editData.totalIncVat : page.properties.totalIncVat) as string | number}
                                editable={isEditing && editData.lines.length === 0}
                                onChange={v => setEditData(p => ({ ...p, totalIncVat: v }))}
                            />
                            <FinancialCell
                                label="Amount Due"
                                value={amountDue}
                                highlight
                            />
                        </div>

                        {/* Structured line items */}
                        {(isEditing || (page.blocks && page.blocks.filter((b: any) => b.type === 'financial-row').length > 0)) && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Line Items</h3>
                                    {isEditing && (
                                        <button onClick={() => setEditData(p => {
                                            const newLines = [...p.lines, { id: `temp-${Date.now()}`, description: '', quantity: 1, unitCode: 'C62', unitPrice: 0, vatRate: 21, lineTotal: 0, category: '', ledgerAccount: '' }];
                                            const computed = calculateHeaderTotalsFromLines(newLines);
                                            return { ...p, lines: newLines, ...computed };
                                        })} className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                                            + Add Line
                                        </button>
                                    )}
                                </div>
                                <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Description</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Accounting</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-16">Qty</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-24">Price</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-20">VAT%</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-24">Total</th>
                                                {isEditing && <th className="px-3 py-2 w-8"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                            {editData.lines.map((line: any, i: number) => (
                                                <tr key={line.id || i} className="bg-white dark:bg-transparent">
                                                    <td className="px-3 py-2">
                                                        {isEditing ? (
                                                            <input type="text" value={line.description} onChange={e => { const l = [...editData.lines]; l[i].description = e.target.value; setEditData({ ...editData, lines: l }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                        ) : (
                                                            <span className="text-neutral-900 dark:text-white font-medium">{line.description}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {isEditing ? (
                                                            <div className="flex flex-col gap-1 min-w-[120px]">
                                                                <SelectDropdown
                                                                    value={line.category || null}
                                                                    options={getOptionsForProperty('category')}
                                                                    onChange={(val) => {
                                                                        const l = [...editData.lines];
                                                                        l[i].category = val || '';
                                                                        setEditData({ ...editData, lines: l });
                                                                    }}
                                                                    placeholder="Categorie..."
                                                                    compact
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={line.ledgerAccount || ''}
                                                                    onChange={e => {
                                                                        const l = [...editData.lines];
                                                                        l[i].ledgerAccount = e.target.value;
                                                                        setEditData({ ...editData, lines: l });
                                                                    }}
                                                                    placeholder="Grootboek..."
                                                                    className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col text-neutral-500 text-[10px]">
                                                                {line.category ? (
                                                                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                                                        {getOptionsForProperty('category').find(o => o.id === line.category)?.name || line.category}
                                                                    </span>
                                                                ) : null}
                                                                {line.ledgerAccount ? (
                                                                    <span>Rek: {line.ledgerAccount}</span>
                                                                ) : null}
                                                                {!line.category && !line.ledgerAccount && <span className="italic opacity-50">—</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="1" value={line.quantity} onChange={e => { const l = [...editData.lines]; l[i].quantity = parseFloat(e.target.value) || 0; l[i].lineTotal = l[i].quantity * l[i].unitPrice; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                                                        ) : (
                                                            <span className="text-neutral-500">{line.quantity || 0}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="0.01" value={line.unitPrice} onChange={e => { const l = [...editData.lines]; l[i].unitPrice = parseFloat(e.target.value) || 0; l[i].lineTotal = l[i].quantity * l[i].unitPrice; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                                                        ) : (
                                                            <span className="text-neutral-500">€{Number(line.unitPrice || 0).toFixed(2)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="0.01" value={line.vatRate} onChange={e => { const l = [...editData.lines]; l[i].vatRate = parseFloat(e.target.value) || 0; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                                                        ) : (
                                                            <span className="text-neutral-500">{line.vatRate || 0}%</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="0.01" value={line.lineTotal} onChange={e => { const l = [...editData.lines]; l[i].lineTotal = parseFloat(e.target.value) || 0; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-medium" />
                                                        ) : (
                                                            <span className="text-neutral-900 dark:text-white font-medium">€{Number(line.lineTotal || 0).toFixed(2)}</span>
                                                        )}
                                                    </td>
                                                    {isEditing && (
                                                        <td className="px-2 py-2 text-center">
                                                            <button onClick={() => { const l = editData.lines.filter((_, idx) => idx !== i); const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="text-red-400 hover:text-red-600">
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Left Footer Action bar */}
                    <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-black/10">
                        <div className="flex items-center gap-2">
                            {status === 'opt-draft' && (
                                <>
                                    <button
                                        onClick={handleApprove}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 text-xs font-bold rounded-lg transition-colors"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => setRejectMode(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30 text-xs font-bold rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Reject
                                    </button>
                                </>
                            )}
                            {status === 'opt-unpaid' && (
                                <button
                                    onClick={handleMarkPaid}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Mark Paid
                                </button>
                            )}
                            {status === 'opt-disputed' && page?.properties.rejectionNote && (
                                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg max-w-xs">
                                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed truncate">{String(page.properties.rejectionNote)}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    Save Changes
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                            <button
                                onClick={handleExportPDF}
                                disabled={exportingPdf}
                                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                title="Export PDF"
                            >
                                {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
                                PDF
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Pane (Viewer / Attachments) */}
                <div className="w-[45%] flex flex-col bg-neutral-100 dark:bg-neutral-950 relative">
                    {/* Right Header Tab bar */}
                    <div className="px-6 py-3 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-[#191919]">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setRightTab('preview')}
                                className={`text-sm font-bold pb-1 border-b-2 transition-all ${rightTab === 'preview' ? 'border-orange-500 text-orange-500' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                            >
                                Preview Document
                            </button>
                            <button
                                onClick={() => setRightTab('attachments')}
                                className={`text-sm font-bold pb-1 border-b-2 transition-all ${rightTab === 'attachments' ? 'border-orange-500 text-orange-500' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                            >
                                Bijlagen ({[page.properties.receiptUrl && 1, isPeppol && 1].filter(Boolean).length})
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors shrink-0 xl:block hidden">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tab Panels */}
                    <div className="flex-1 p-4 flex flex-col min-h-0 relative">
                        {rightTab === 'preview' ? (
                            page.properties.receiptUrl && typeof page.properties.receiptUrl === 'string' ? (
                                <div className="w-full h-full relative overflow-hidden rounded-xl border border-neutral-200 dark:border-white/10 bg-white">
                                    {/* Zoom & Pan Toolbar */}
                                    <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border border-neutral-200 dark:border-white/10 rounded-lg p-1 shadow-lg">
                                        <button
                                            onClick={() => setZoom(z => Math.min(z + 0.15, 3))}
                                            className="px-2.5 py-1 rounded hover:bg-neutral-250 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 font-bold text-sm"
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                        <button
                                            onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))}
                                            className="px-2.5 py-1 rounded hover:bg-neutral-250 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 font-bold text-sm"
                                            title="Zoom Out"
                                        >
                                            -
                                        </button>
                                        <button
                                            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                                            className="px-2 py-1 rounded hover:bg-neutral-250 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 text-[10px] font-bold"
                                            title="Reset"
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    {/* Viewer Container */}
                                    <div 
                                        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative"
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseUp}
                                    >
                                        {zoom !== 1 && (
                                            <div className="absolute inset-0 z-20 bg-transparent" />
                                        )}
                                        <iframe 
                                            src={page.properties.receiptUrl.startsWith('http') ? page.properties.receiptUrl : `/api/files/${page.properties.receiptUrl}`} 
                                            className={`w-full h-full border-none bg-white transition-transform duration-75 origin-center ${isDragging ? 'pointer-events-none' : ''}`}
                                            style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                                            title="Original Document"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center w-full h-full text-neutral-400 bg-white/40 dark:bg-white/5 rounded-xl border border-dashed border-neutral-300 dark:border-white/20 p-4">
                                    <FileText className="w-12 h-12 mb-4 opacity-50" />
                                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Geen document gekoppeld</p>
                                    <p className="text-xs mt-1 opacity-70 mb-4 text-center max-w-xs">Deze factuur is handmatig aangemaakt of heeft nog geen PDF scan.</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploaden...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-3.5 h-3.5" /> Upload Document
                                            </>
                                        )}
                                    </button>
                                </div>
                            )
                        ) : (
                            /* Attachments list tab */
                            <div className="flex-1 overflow-y-auto space-y-4">
                                {/* Peppol XML UBL file */}
                                {isPeppol && page.properties.peppolDocId && (
                                    <div className="p-4 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-neutral-900 dark:text-white">UBL XML Factuur</p>
                                                <p className="text-[10px] text-neutral-400">Origineel Peppol e-invoice bestand</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleDownloadXml}
                                            className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 transition-colors"
                                            title="Download XML"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {/* PDF Receipt */}
                                {page.properties.receiptUrl && typeof page.properties.receiptUrl === 'string' ? (
                                    <div className="p-4 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/20 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-neutral-900 dark:text-white truncate max-w-[200px]">
                                                    {page.properties.receiptUrl.split('/').pop() || 'scanned_receipt.pdf'}
                                                </p>
                                                <p className="text-[10px] text-neutral-400">Gekoppeld PDF document</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <a
                                                href={page.properties.receiptUrl.startsWith('http') ? page.properties.receiptUrl : `/api/files/${page.properties.receiptUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 transition-colors"
                                                title="Open in nieuw tabblad"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <button
                                                onClick={handleRemoveReceipt}
                                                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
                                                title="Ontkoppelen"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Upload receipt block inside attachments list */
                                    <div className="p-6 bg-white dark:bg-white/5 border border-dashed border-neutral-300 dark:border-white/20 rounded-xl text-center flex flex-col items-center justify-center">
                                        <Upload className="w-8 h-8 text-neutral-400 mb-2 opacity-60" />
                                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">Geen bon/factuur gekoppeld</p>
                                        <p className="text-[10px] text-neutral-400 mb-4">Upload een PDF of afbeelding van de originele factuur</p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="application/pdf,image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {uploading ? 'Uploaden...' : 'Bestand selecteren'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ──

function InfoField({ label, value, editable, type, onChange }: {
    label: string;
    value: string;
    editable?: boolean;
    type?: string;
    onChange?: (v: string) => void;
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{label}</label>
            {editable ? (
                <input
                    type={type || 'text'}
                    value={value}
                    onChange={e => onChange?.(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
            ) : (
                <p className="text-sm text-neutral-900 dark:text-white font-medium">{value || '-'}</p>
            )}
        </div>
    );
}

function OptionDisplay({ value, options }: { value: string; options: any[] }) {
    const option = options.find(o => o.id === value || o.name === value);
    return (
        <span className="inline-flex items-center gap-1.5 font-medium text-sm text-neutral-900 dark:text-white mt-1">
            {option ? option.name : (value || '—')}
        </span>
    );
}

function FinancialCell({ label, value, editable, highlight, onChange }: {
    label: string;
    value: string | number | null | undefined;
    editable?: boolean;
    highlight?: boolean;
    onChange?: (v: string) => void;
}) {
    const formatted = value && !isNaN(parseFloat(String(value)))
        ? `€${parseFloat(String(value)).toFixed(2)}`
        : '-';

    return (
        <div className={`px-4 py-3 ${highlight ? 'bg-orange-50/50 dark:bg-blue-950/10' : ''}`}>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">{label}</p>
            {editable ? (
                <input
                    type="number"
                    step="0.01"
                    value={String(value || '')}
                    onChange={e => onChange?.(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
            ) : (
                <p className={`text-base font-bold ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-900 dark:text-white'}`}>
                    {formatted}
                </p>
            )}
        </div>
    );
}
