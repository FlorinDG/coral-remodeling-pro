"use client";

import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, FileText, Loader2, Sparkles, Receipt } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';

interface TicketCaptureModalProps {
    onClose: () => void;
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
    receiptUrl: string;
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

export default function TicketCaptureModal({ onClose }: TicketCaptureModalProps) {
    const createPage = useDatabaseStore(s => s.createPage);
    const [step, setStep] = useState<'capture' | 'form'>('capture');
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [ocrRawText, setOcrRawText] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<TicketFormData>({
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        vatAmount: '',
        category: '',
        currency: 'cur-eur',
        paymentMethod: 'pm-card',
        notes: '',
        receiptUrl: '',
    });

    const updateForm = (key: keyof TicketFormData, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleFileSelected = useCallback(async (file: File) => {
        // Show preview
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setIsProcessing(true);

        try {
            // Dynamically import OCR to avoid loading Tesseract on page load
            const { recognizeReceipt } = await import('@/lib/ocr');
            const result = await recognizeReceipt(file);

            setOcrRawText(result.rawText);

            // Pre-fill form with OCR results (import-first: fill what we can)
            setForm(prev => ({
                ...prev,
                merchant: result.extractedMerchant || prev.merchant,
                date: result.extractedDate || prev.date,
                amount: result.extractedAmount ? result.extractedAmount.toFixed(2) : prev.amount,
                vatAmount: result.extractedVatAmount ? result.extractedVatAmount.toFixed(2) : prev.vatAmount,
                // Category left blank — can't infer from OCR reliably
            }));

            setStep('form');
        } catch (err) {
            console.error('OCR failed:', err);
            // Still proceed to form even if OCR fails
            setStep('form');
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleUploadClick = () => fileInputRef.current?.click();
    const handleCameraClick = () => cameraInputRef.current?.click();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelected(file);
    };

    const handleSkipToManual = () => {
        setStep('form');
    };

    const handleSave = () => {
        if (!form.merchant.trim() && !form.amount.trim()) return;

        createPage('db-tickets', {
            title: form.merchant || 'Unnamed Expense',
            date: form.date,
            amount: form.amount ? parseFloat(form.amount) : 0,
            vatAmount: form.vatAmount ? parseFloat(form.vatAmount) : 0,
            category: form.category || '',
            currency: form.currency,
            paymentMethod: form.paymentMethod,
            receiptUrl: form.receiptUrl || previewUrl || '',
            notes: form.notes,
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-neutral-900 dark:text-white">New Expense Ticket</h2>
                            <p className="text-xs text-neutral-500">
                                {step === 'capture' ? 'Upload or scan a receipt' : 'Complete the details'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {step === 'capture' && (
                        <div className="space-y-4">
                            {/* Processing overlay */}
                            {isProcessing && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="relative">
                                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                        <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Processing receipt...</p>
                                        <p className="text-xs text-neutral-500 mt-1">Extracting text with OCR</p>
                                    </div>
                                    {previewUrl && (
                                        <img src={previewUrl} alt="Receipt preview" className="w-32 h-auto rounded-lg border border-neutral-200 dark:border-white/10 shadow-sm mt-2" />
                                    )}
                                </div>
                            )}

                            {/* Upload area */}
                            {!isProcessing && (
                                <>
                                    <div
                                        onClick={handleUploadClick}
                                        className="group cursor-pointer border-2 border-dashed border-neutral-300 dark:border-white/20 rounded-xl p-8 text-center hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-all"
                                    >
                                        <Upload className="w-8 h-8 text-neutral-400 group-hover:text-orange-500 mx-auto mb-3 transition-colors" />
                                        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Upload Receipt</p>
                                        <p className="text-xs text-neutral-500 mt-1">Click or drag a photo/PDF</p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                                        <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider">or</span>
                                        <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                                    </div>

                                    <button
                                        onClick={handleCameraClick}
                                        className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-neutral-100 dark:bg-white/5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-neutral-200 dark:border-white/10 hover:border-orange-300 dark:hover:border-orange-600 transition-all"
                                    >
                                        <Camera className="w-5 h-5 text-neutral-500" />
                                        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Take Photo</span>
                                    </button>

                                    <button
                                        onClick={handleSkipToManual}
                                        className="w-full flex items-center justify-center gap-3 px-4 py-3 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm font-medium transition-colors"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Enter manually without receipt
                                    </button>
                                </>
                            )}

                            {/* Hidden file inputs */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={handleInputChange}
                            />
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handleInputChange}
                            />
                        </div>
                    )}

                    {step === 'form' && (
                        <div className="space-y-5">
                            {/* Receipt preview (if available) */}
                            {previewUrl && (
                                <div className="flex gap-4">
                                    <img src={previewUrl} alt="Receipt" className="w-20 h-28 object-cover rounded-lg border border-neutral-200 dark:border-white/10 shadow-sm shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1 mb-1">
                                            <Sparkles className="w-3 h-3" /> OCR Processed
                                        </p>
                                        <p className="text-[10px] text-neutral-400 line-clamp-4 font-mono">{ocrRawText.substring(0, 200) || 'No text extracted'}</p>
                                    </div>
                                </div>
                            )}

                            {/* Merchant */}
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Merchant / Description</label>
                                <input
                                    type="text"
                                    value={form.merchant}
                                    onChange={e => updateForm('merchant', e.target.value)}
                                    placeholder="e.g. Total Station Brussel"
                                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                                />
                            </div>

                            {/* Date + Amount row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Date</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => updateForm('date', e.target.value)}
                                        className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Total Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">€</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.amount}
                                            onChange={e => updateForm('amount', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-3 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* VAT Amount + Currency */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">VAT Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">€</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.vatAmount}
                                            onChange={e => updateForm('vatAmount', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-3 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Currency</label>
                                    <select
                                        value={form.currency}
                                        onChange={e => updateForm('currency', e.target.value)}
                                        className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                                    >
                                        <option value="cur-eur">EUR</option>
                                        <option value="cur-usd">USD</option>
                                        <option value="cur-gbp">GBP</option>
                                    </select>
                                </div>
                            </div>

                            {/* Category chips */}
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => updateForm('category', form.category === cat.id ? '' : cat.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                form.category === cat.id
                                                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 shadow-sm'
                                                    : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20'
                                            }`}
                                        >
                                            <span>{cat.icon}</span>
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Payment Method</label>
                                <div className="flex gap-2">
                                    {PAYMENT_METHODS.map(pm => (
                                        <button
                                            key={pm.id}
                                            onClick={() => updateForm('paymentMethod', pm.id)}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                                                form.paymentMethod === pm.id
                                                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                                                    : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                                            }`}
                                        >
                                            {pm.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => updateForm('notes', e.target.value)}
                                    placeholder="Optional notes..."
                                    rows={2}
                                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'form' && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                        <button
                            onClick={() => { setStep('capture'); setPreviewUrl(null); }}
                            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium transition-colors"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!form.merchant.trim() && !form.amount.trim()}
                            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                            Save Ticket
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
