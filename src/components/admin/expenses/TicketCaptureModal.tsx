/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { X, Camera, Upload, FileText, Loader2, Sparkles, Receipt, Scissors, Copy, CheckCircle, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Page } from '@/components/admin/database/types';
import { createPageServerFirst, updatePageServerFirst } from '@/app/actions/pages';
import { uploadFileAction } from '@/app/actions/files';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { parseDecimal } from '@/lib/decimal-parser';

interface TicketCaptureModalProps {
    onClose: () => void;
    /** If provided, saves the record to this database instead of db-tickets (default) */
    targetDatabaseId?: string;
}

interface TicketFormData {
    merchant: string;
    date: string;
    amount: string;
    vatAmount: string;
    category: string;
    currency: string;
    paymentMethod: string;
    notes: string;
}

interface ScanResult {
    page: Page;
    extracted: Record<string, any>;
}

const CATEGORIES = [
    { id: 'cat-fuel', label: 'Fuel', icon: '⛽' },
    { id: 'cat-restaurant', label: 'Restaurant', icon: '🍽️' },
    { id: 'cat-office', label: 'Office Supplies', icon: '📎' },
    { id: 'cat-tools', label: 'Tools', icon: '🔧' },
    { id: 'cat-materials', label: 'Materials', icon: '🧱' },
    { id: 'cat-parking', label: 'Parking', icon: '🅿️' },
    { id: 'cat-transport', label: 'Transport', icon: '🚗' },
    { id: 'cat-other', label: 'Other', icon: '📦' },
];

const PAYMENT_METHODS = [
    { id: 'pm-cash', label: 'Cash' },
    { id: 'pm-card', label: 'Card' },
    { id: 'pm-transfer', label: 'Bank Transfer' },
];

export default function TicketCaptureModal({ onClose, targetDatabaseId = 'db-tickets' }: TicketCaptureModalProps) {
    const { data: session } = useSession();
    const planType = (session?.user as any)?.planType ?? 'FREE';
    const isFree = planType === 'FREE';

    const addConfirmedPage = useDatabaseStore(s => s.addConfirmedPage);
    const createPage = useDatabaseStore(s => s.createPage);
    const isInvoiceMode = targetDatabaseId === 'db-expenses';

    // Steps: capture → (split-confirm →) review → saving → done
    const [step, setStep] = useState<'capture' | 'split-confirm' | 'review' | 'saving' | 'done' | 'error'>('capture');
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [scanError, setScanError] = useState<string>('');
    const [saveError, setSaveError] = useState<string>('');
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const lastFileRef = useRef<File | null>(null);

    const [form, setForm] = useState<TicketFormData>({
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        vatAmount: '',
        category: '',
        currency: 'cur-eur',
        paymentMethod: 'pm-card',
        notes: '',
    });

    const [lastSavedDetails, setLastSavedDetails] = useState<{ merchant: string; amount: string } | null>(null);

    const updateForm = (key: keyof TicketFormData, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleAutoCalcVat = (ratePercent: number) => {
        const gross = parseDecimal(form.amount) ?? 0;
        if (gross <= 0) return;
        const net = gross / (1 + ratePercent / 100);
        const vat = gross - net;
        const roundedVat = Math.round(vat * 100) / 100;
        updateForm('vatAmount', String(roundedVat));
    };

    const handleResetFlow = () => {
        setForm({
            merchant: '',
            date: new Date().toISOString().split('T')[0],
            amount: '',
            vatAmount: '',
            category: '',
            currency: 'cur-eur',
            paymentMethod: 'pm-card',
            notes: '',
        });
        setPreviewUrl(null);
        setScanResult(null);
        setScanError('');
        setSaveError('');
        lastFileRef.current = null;
        setStep('capture');
    };

    // ── Server-side scan ──────────────────────────────────────────────────────
    const runScan = useCallback(async (file: File) => {
        lastFileRef.current = file;
        setScanError('');

        // Image preview (images only, not PDFs)
        if (file.type.startsWith('image/')) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(null);
        }

        setStep('capture'); // keep on capture to show spinner

        let clientExtracted: Record<string, any> | null = null;
        if (isFree && file.type.startsWith('image/')) {
            try {
                const { recognizeReceipt } = await import('@/lib/ocr');
                const ocrResult = await recognizeReceipt(file);

                clientExtracted = isInvoiceMode ? {
                    supplierName: ocrResult.extractedMerchant,
                    issueDate: ocrResult.extractedDate,
                    totalExVat: ocrResult.extractedAmount,
                    totalVat: ocrResult.extractedVatAmount,
                    lines: []
                } : {
                    merchant: ocrResult.extractedMerchant,
                    date: ocrResult.extractedDate,
                    totalAmount: ocrResult.extractedAmount,
                    vatAmount: ocrResult.extractedVatAmount,
                    category: null
                };
            } catch (err: any) {
                console.error('[TicketCaptureModal] Client-side OCR error:', err);
                clientExtracted = null;
            }
        }

        const fd = new FormData();
        fd.append('file', file);
        fd.append('targetDb', targetDatabaseId);
        if (clientExtracted) {
            fd.append('clientExtracted', JSON.stringify(clientExtracted));
        }

        try {
            const res = await fetch('/api/scan', { method: 'POST', body: fd });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setScanError(data.error || 'Scan failed. Please try again or enter manually.');
                return;
            }

            setScanResult(data);

            // Pre-fill form from extracted fields
            const ext = data.extracted || {};
            if (isInvoiceMode) {
                setForm(prev => ({
                    ...prev,
                    merchant: ext.supplierName || prev.merchant,
                    date: ext.issueDate || prev.date,
                    amount: ext.totalExVat != null ? String(ext.totalExVat) : prev.amount,
                    vatAmount: ext.totalVat != null ? String(ext.totalVat) : prev.vatAmount,
                }));
            } else {
                setForm(prev => ({
                    ...prev,
                    merchant: ext.merchant || prev.merchant,
                    date: ext.date || prev.date,
                    amount: ext.totalAmount != null ? String(ext.totalAmount) : prev.amount,
                    vatAmount: ext.vatAmount != null ? String(ext.vatAmount) : prev.vatAmount,
                    category: ext.category || prev.category,
                }));
            }

            setStep('review');
        } catch (e: any) {
            setScanError(e?.message || 'Network error. Check your connection and try again.');
        }
    }, [targetDatabaseId, isInvoiceMode, isFree]);

    const handleFileSelected = useCallback((file: File) => {
        runScan(file);
    }, [runScan]);

    // ── Drag and Drop ─────────────────────────────────────────────────────────
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
    }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelected(file);
    }, [handleFileSelected]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelected(file);
        e.target.value = '';
    };

    // ── Save (update the already-saved record with user edits) ────────────────
    const handleSave = async () => {
        const parsedAmount = parseDecimal(form.amount) ?? 0;
        const parsedVat = parseDecimal(form.vatAmount) ?? 0;
        setLastSavedDetails({
            merchant: form.merchant || (isInvoiceMode ? 'Manual Invoice' : 'Unnamed Expense'),
            amount: form.amount
        });

        setStep('saving');
        setSaveError('');

        let receiptUrl = '';
        if (lastFileRef.current) {
            try {
                const fd = new FormData();
                fd.append('file', lastFileRef.current);
                const uploadRes = await uploadFileAction(fd, isInvoiceMode ? 'purchase-invoice' : 'receipt');
                if (uploadRes.success && uploadRes.key) {
                    receiptUrl = uploadRes.key;
                } else {
                    console.warn('[TicketCaptureModal] Blob upload failed', uploadRes.error);
                }
            } catch (err) {
                console.warn('[TicketCaptureModal] Blob upload network error', err);
            }
        }

        if (!scanResult) {
            // Manual entry — server-first
            try {
                if (isInvoiceMode) {
                    const result = await createPageServerFirst(targetDatabaseId, {
                        title: form.merchant || 'Manual Invoice',
                        source: 'src-manual',
                        status: 'opt-draft',
                        invoiceDate: form.date,
                        supplier: [],
                        totalExVat: parsedAmount,
                        totalVat: parsedVat,
                        totalIncVat: parsedAmount + parsedVat,
                        receiptUrl: receiptUrl,
                    });
                    if (result.success) addConfirmedPage(result.page);
                } else {
                    const result = await createPageServerFirst(targetDatabaseId, {
                        title: form.merchant || 'Unnamed Expense',
                        date: form.date,
                        amount: parsedAmount,
                        vatAmount: parsedVat,
                        category: form.category || '',
                        currency: form.currency,
                        paymentMethod: form.paymentMethod,
                        notes: form.notes,
                        receiptUrl: receiptUrl,
                    });
                    if (result.success) addConfirmedPage(result.page);
                }
                setStep('done');
            } catch (e) {
                console.error('[TicketCaptureModal] manual save failed:', e);
                setSaveError('Failed to save. Please try again.');
                setStep('review');
            }
            return;
        }

        // Scanned record: update the server-saved page with user edits
        try {
            const currentProps = scanResult.page.properties as Record<string, any>;
            let updatedProps: Record<string, any>;

            if (isInvoiceMode) {
                updatedProps = {
                    ...currentProps,
                    title: form.merchant || currentProps.title,
                    supplierName: form.merchant || currentProps.supplierName,
                    invoiceDate: form.date,
                    totalExVat: parsedAmount,
                    totalVat: parsedVat,
                    totalIncVat: parsedAmount + parsedVat,
                    status: 'opt-unpaid',
                };
                if (receiptUrl) updatedProps.receiptUrl = receiptUrl;
            } else {
                updatedProps = {
                    ...currentProps,
                    title: form.merchant || currentProps.title,
                    date: form.date,
                    amount: parsedAmount,
                    vatAmount: parsedVat,
                    category: form.category || currentProps.category,
                    paymentMethod: form.paymentMethod,
                    notes: form.notes,
                };
                if (receiptUrl) updatedProps.receiptUrl = receiptUrl;
            }

            const result = await updatePageServerFirst(scanResult.page.id, updatedProps);

            if (!result.success) {
                setSaveError(result.error || 'Save failed');
                setStep('review');
                return;
            }

            addConfirmedPage(result.page);
            setStep('done');
        } catch (e: any) {
            setSaveError(e?.message || 'Network error during save');
            setStep('review');
        }
    };

    const handleSkipToManual = () => {
        setScanResult(null);
        setStep('review');
    };

    const isLoading = step === 'capture' && !scanError && lastFileRef.current !== null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                            {step === 'done'
                                ? <CheckCircle className="w-5 h-5 text-green-600" />
                                : step === 'saving'
                                ? <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                                : <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            }
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                                {isInvoiceMode ? 'Scan / Upload Invoice' : 'New Expense Ticket'}
                            </h2>
                            <p className="text-xs text-neutral-500">
                                {step === 'capture' && !isLoading && 'Upload or scan a document'}
                                {isLoading && (isFree ? 'Reading your document locally…' : 'AI is reading your document…')}
                                {step === 'review' && (scanResult ? 'Review extracted data' : 'Enter details manually')}
                                {step === 'split-confirm' && `Multi-page PDF — ${pdfPageCount} pages`}
                                {step === 'saving' && 'Saving to database…'}
                                {step === 'done' && 'Saved successfully!'}
                                {step === 'error' && 'Something went wrong'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[75vh] overflow-y-auto">

                    {/* ── CAPTURE STEP ── */}
                    {(step === 'capture') && (
                        <div className="space-y-4">
                            {/* AI Processing overlay */}
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                        </div>
                                        <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                                            {isFree ? 'Reading locally…' : 'Analysing with AI…'}
                                        </p>
                                        <p className="text-xs text-neutral-500 mt-1">
                                            {isFree ? 'Tesseract.js is reading the document' : 'GPT-4o is reading the document'}
                                        </p>
                                    </div>
                                    {previewUrl && (
                                        <img src={previewUrl} alt="Preview" className="w-28 h-auto rounded-xl border border-neutral-200 dark:border-white/10 shadow-sm" />
                                    )}
                                </div>
                            )}

                            {/* Error state */}
                            {scanError && (
                                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Scan failed</p>
                                            <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">{scanError}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setScanError(''); lastFileRef.current = null; }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Try again
                                        </button>
                                        <button
                                            onClick={handleSkipToManual}
                                            className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                        >
                                            Enter manually
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Upload area (only when not loading and no error) */}
                            {!isLoading && !scanError && (
                                <div className="flex flex-col gap-4">
                                    {/* CAMERA ACTION FIRST */}
                                    <button
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="w-full flex flex-col items-center justify-center gap-3 px-6 py-8 bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-2xl border border-orange-400 text-white shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
                                            <Camera className="w-7 h-7 text-white" />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-base font-bold tracking-wide">Take Receipt Photo</span>
                                            <p className="text-xs text-orange-100 mt-1">Camera-first quick capture</p>
                                        </div>
                                    </button>

                                    <div className="flex items-center gap-3 py-2">
                                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                                        <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider">or upload files</span>
                                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                                    </div>

                                    {/* Upload area */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`group cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                                            isDragging
                                                ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20 scale-[1.01]'
                                                : 'border-neutral-300 dark:border-white/20 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/10'
                                        }`}
                                    >
                                        <Upload className={`w-6 h-6 mx-auto mb-2 transition-colors ${isDragging ? 'text-orange-500' : 'text-neutral-400 group-hover:text-orange-500'}`} />
                                        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                                            Select existing PDF/Image
                                        </p>
                                        <p className="text-xs text-neutral-500 mt-0.5">
                                            Click or drag file here
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleSkipToManual}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm font-medium transition-colors"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Enter details manually
                                    </button>
                                </div>
                            )}

                            {/* Hidden inputs */}
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleInputChange} />
                            <input ref={cameraInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleInputChange} />
                        </div>
                    )}

                    {/* ── REVIEW / FORM STEP ── */}
                    {step === 'review' && (
                        <div className="space-y-4">
                            {/* Scan confirmed banner */}
                            {scanResult && (
                                <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 rounded-xl px-4 py-3">
                                    <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                                    <p className="text-xs font-medium text-green-700 dark:text-green-400">
                                        AI extracted the data below — review and confirm before saving.
                                    </p>
                                </div>
                            )}

                            {/* Preview thumbnail */}
                            {previewUrl && (
                                <div className="flex justify-center">
                                    <img src={previewUrl} alt="Document" className="h-24 w-auto rounded-xl border border-neutral-200 dark:border-white/10 shadow-sm object-cover" />
                                </div>
                            )}

                            {/* Save error */}
                            {saveError && (
                                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                    <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
                                </div>
                            )}

                            {/* Merchant / Supplier */}
                            <div>
                                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                    {isInvoiceMode ? 'Supplier' : 'Merchant'}
                                </label>
                                <input
                                    type="text"
                                    value={form.merchant}
                                    onChange={e => updateForm('merchant', e.target.value)}
                                    placeholder={isInvoiceMode ? 'Supplier name' : 'Shop / vendor name'}
                                    className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all"
                                />
                            </div>

                            {/* Date + Amount row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <label className="flex items-center gap-1 text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                        Date {scanResult && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                    </label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => updateForm('date', e.target.value)}
                                        className={`w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 text-neutral-900 dark:text-white transition-all ${
                                            scanResult ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/10' : 'border-neutral-200 dark:border-white/10'
                                        }`}
                                    />
                                </div>
                                <div className="relative">
                                    <label className="flex items-center gap-1 text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                        {isInvoiceMode ? 'Total Excl. VAT' : 'Amount'} {scanResult && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={form.amount}
                                        onChange={e => {
                                            const v = e.target.value;
                                            if (/^-?[\d.,]*$/.test(v) || v === '') {
                                                updateForm('amount', v);
                                            }
                                        }}
                                        placeholder="0.00"
                                        className={`w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 text-neutral-900 dark:text-white transition-all ${
                                            scanResult ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/10' : 'border-neutral-200 dark:border-white/10'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* VAT */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <label className="flex items-center gap-1 text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                        VAT Amount {scanResult && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={form.vatAmount}
                                        onChange={e => {
                                            const v = e.target.value;
                                            if (/^-?[\d.,]*$/.test(v) || v === '') {
                                                updateForm('vatAmount', v);
                                            }
                                        }}
                                        placeholder="0.00"
                                        className={`w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 text-neutral-900 dark:text-white transition-all ${
                                            scanResult ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/10' : 'border-neutral-200 dark:border-white/10'
                                        }`}
                                    />
                                    {/* Auto-calc quick actions */}
                                    <div className="flex gap-1.5 mt-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleAutoCalcVat(21)}
                                            className="px-2 py-0.5 text-[10px] font-bold bg-neutral-100 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-950/30 text-neutral-600 dark:text-neutral-300 rounded border border-neutral-200 dark:border-white/10 transition-colors"
                                        >
                                            Calc 21%
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAutoCalcVat(6)}
                                            className="px-2 py-0.5 text-[10px] font-bold bg-neutral-100 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-950/30 text-neutral-600 dark:text-neutral-300 rounded border border-neutral-200 dark:border-white/10 transition-colors"
                                        >
                                            Calc 6%
                                        </button>
                                    </div>
                                </div>
                                {!isInvoiceMode && (
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Payment</label>
                                        <SearchableSelect
                                            options={PAYMENT_METHODS.map(pm => ({ value: pm.id, label: pm.label }))}
                                            value={form.paymentMethod}
                                            onChange={(v) => updateForm('paymentMethod', v)}
                                            placeholder="Method"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Category (tickets only) */}
                            {!isInvoiceMode && (
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">Category</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => updateForm('category', cat.id)}
                                                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                                                    form.category === cat.id
                                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                                                        : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-950/10'
                                                }`}
                                            >
                                                <span className="text-base">{cat.icon}</span>
                                                <span className="leading-tight text-center">{cat.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => updateForm('notes', e.target.value)}
                                    rows={2}
                                    placeholder="Optional notes…"
                                    className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 text-neutral-900 dark:text-white resize-none transition-all"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => { setScanResult(null); setStep('capture'); setScanError(''); lastFileRef.current = null; }}
                                    className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm shadow-orange-500/20"
                                >
                                    {scanResult ? 'Confirm & Save' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── SAVING STEP ── */}
                    {step === 'saving' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Saving to database…</p>
                            <p className="text-xs text-neutral-500">This will be available on all your devices.</p>
                        </div>
                    )}

                    {/* ── DONE STEP ── */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Saved successfully!</p>
                                {lastSavedDetails && (
                                    <p className="text-xs text-neutral-500 mt-1 font-medium">
                                        {lastSavedDetails.merchant} &middot; €{lastSavedDetails.amount}
                                    </p>
                                )}
                            </div>

                            {/* Loop scanning buttons */}
                            <div className="flex flex-col gap-2 w-full pt-4 max-w-[240px]">
                                <button
                                    onClick={handleResetFlow}
                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm shadow-orange-500/20"
                                >
                                    Scan Another
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all"
                                >
                                    Finish
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
