"use client";

import React, { useState } from 'react';
import { Upload, Trash2, ExternalLink, FileText, Plus, X } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { uploadFileAction, deleteFileAction } from '@/app/actions/files';

interface SupplierQuotation {
    id: string;
    supplierId: string;
    supplierName: string;
    amount: number;
    fileKey: string;
    note?: string;
    uploadedAt: string;
}

interface SupplierQuotationsCardProps {
    projectId: string;
    quotations: SupplierQuotation[];
    suppliers: { value: string; label: string }[];
    onUpdate: (newQuotations: SupplierQuotation[]) => void;
}

export default function SupplierQuotationsCard({ projectId, quotations, suppliers, onUpdate }: SupplierQuotationsCardProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const [formData, setFormData] = useState({
        supplierId: '',
        supplierName: '',
        amount: '',
        note: ''
    });
    
    const [file, setFile] = useState<File | null>(null);

    const handleSupplierChange = (val: string) => {
        const found = suppliers.find(s => s.value === val);
        setFormData({ ...formData, supplierId: val, supplierName: found?.label || val });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || (!formData.supplierId && !formData.supplierName) || !formData.amount) {
            alert('Please provide a file, supplier, and amount.');
            return;
        }

        setIsUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            
            const uploadRes = await uploadFileAction(fd, 'supplier-quote', projectId);
            
            if (!uploadRes.success || !uploadRes.key) {
                throw new Error(uploadRes.error || 'Upload failed');
            }

            const newQuotation: SupplierQuotation = {
                id: crypto.randomUUID(),
                supplierId: formData.supplierId,
                supplierName: formData.supplierName,
                amount: parseFloat(formData.amount),
                fileKey: uploadRes.key,
                note: formData.note,
                uploadedAt: new Date().toISOString()
            };

            onUpdate([...quotations, newQuotation]);
            
            setIsAdding(false);
            setFile(null);
            setFormData({ supplierId: '', supplierName: '', amount: '', note: '' });
        } catch (err: any) {
            console.error('Error saving supplier quotation:', err);
            alert(err.message || 'Failed to save quotation');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (quote: SupplierQuotation) => {
        if (!confirm('Are you sure you want to delete this quotation?')) return;
        
        try {
            await deleteFileAction(quote.fileKey);
            onUpdate(quotations.filter(q => q.id !== quote.id));
        } catch (err) {
            console.error('Failed to delete file:', err);
            // Even if delete API fails (e.g., file already gone), we might still want to remove it from DB
            onUpdate(quotations.filter(q => q.id !== quote.id));
        }
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-widest text-neutral-800 dark:text-neutral-200">
                    <FileText className="w-4 h-4 text-[#d35400]" /> 
                    Leveranciersoffertes <span className="opacity-50 font-normal">/ Supplier Quotations</span>
                </div>
                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-neutral-900 dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-lg hover:bg-[#d35400] transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Add
                    </button>
                )}
            </div>

            <div className="p-5 space-y-4">
                {isAdding && (
                    <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-200 dark:border-white/10 relative animate-in fade-in slide-in-from-top-2 duration-200">
                        <button 
                            onClick={() => setIsAdding(false)}
                            className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <form onSubmit={handleSave} className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Supplier</label>
                                    <SearchableSelect
                                        options={suppliers}
                                        value={formData.supplierId}
                                        onChange={handleSupplierChange}
                                        placeholder="Select supplier..."
                                        className="w-full"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Or type custom name..." 
                                        value={formData.supplierName}
                                        onChange={e => setFormData({ ...formData, supplierName: e.target.value, supplierId: '' })}
                                        className="mt-2 w-full px-3 py-2 text-sm bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl focus:border-[#d35400] outline-none"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Amount (Excl. VAT)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-neutral-400">€</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                required
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl focus:border-[#d35400] outline-none font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Note (Optional)</label>
                                        <input 
                                            type="text"
                                            value={formData.note}
                                            onChange={e => setFormData({ ...formData, note: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl focus:border-[#d35400] outline-none"
                                            placeholder="Reference or note..."
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">File</label>
                                <input 
                                    type="file"
                                    required
                                    accept=".pdf,image/*"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#d35400]/10 file:text-[#d35400] hover:file:bg-[#d35400]/20"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isUploading || !file}
                                className="w-full py-3 bg-[#d35400] hover:bg-[#a04000] text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isUploading ? (
                                    <>Uploading...</>
                                ) : (
                                    <><Upload className="w-4 h-4" /> Save Quotation</>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                <div className="space-y-2">
                    {quotations.length === 0 && !isAdding && (
                        <p className="text-center text-sm text-neutral-400 dark:text-neutral-500 italic py-6">No supplier quotations attached yet.</p>
                    )}
                    
                    {quotations.map(quote => (
                        <div key={quote.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-neutral-900 dark:text-white truncate">{quote.supplierName}</span>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                                        €{quote.amount.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {quote.note && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{quote.note}</p>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                                <a 
                                    href={`/api/files/${encodeURIComponent(quote.fileKey)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 rounded-lg text-neutral-500 hover:text-[#d35400] hover:bg-[#d35400]/10 transition-colors"
                                    title="View File"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button 
                                    onClick={() => handleDelete(quote)}
                                    className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title="Delete Quotation"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
