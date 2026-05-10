"use client";

import React, { useState } from 'react';
import { X, Search, Loader2, Building2 } from 'lucide-react';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (pageId: string) => void;
    createPage: (dbId: string, props: Record<string, any>) => any;
    clientsDbId: string;
}

const FIELD_DEFS = [
    { id: 'title',   label: 'Naam',         type: 'text',   placeholder: 'Voornaam / Bedrijfsnaam', required: true },
    { id: 'email',   label: 'E-mail',       type: 'email',  placeholder: 'info@example.com' },
    { id: 'phone',   label: 'Telefoon',     type: 'tel',    placeholder: '+32 ...' },
    { id: 'company', label: 'Bedrijf',      type: 'text',   placeholder: 'Bedrijfsnaam' },
    { id: 'vat',     label: 'BTW-nummer',   type: 'text',   placeholder: 'BE0123.456.789' },
    { id: 'address', label: 'Adres',        type: 'text',   placeholder: 'Straatnaam 123' },
    { id: 'city',    label: 'Gemeente',     type: 'text',   placeholder: 'Brussel' },
    { id: 'postal',  label: 'Postcode',     type: 'text',   placeholder: '1000' },
    { id: 'country', label: 'Land',         type: 'text',   placeholder: 'België' },
    { id: 'notes',   label: 'Notities',     type: 'text',   placeholder: 'Extra info...' },
];

export default function CreateClientModal({ isOpen, onClose, onCreated, createPage, clientsDbId }: CreateClientModalProps) {
    const [form, setForm] = useState<Record<string, string>>({ country: 'België' });
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    if (!isOpen) return null;

    const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    const handlePeppolSearch = async () => {
        const vat = form.vat?.trim();
        if (!vat) return;
        setIsSearching(true);
        setSearchError('');
        try {
            const res = await fetch(`/api/company/lookup?vat=${encodeURIComponent(vat)}`);
            const data = await res.json();
            if (data.error) {
                setSearchError(data.error);
            } else {
                setForm(prev => ({
                    ...prev,
                    company: data.name || prev.company || '',
                    title: data.name || prev.title || '',
                    address: data.street || prev.address || '',
                    city: data.city || prev.city || '',
                    postal: data.postalCode || prev.postal || '',
                    country: data.country || prev.country || 'België',
                }));
            }
        } catch {
            setSearchError('Lookup failed');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmit = () => {
        if (!form.title?.trim()) return;
        const page = createPage(clientsDbId, { ...form });
        if (page) {
            onCreated(page.id);
            onClose();
            setForm({ country: 'België' });
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-white/5">
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                        Nieuwe klant aanmaken
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors">
                        <X className="w-4 h-4 text-neutral-400" />
                    </button>
                </div>

                {/* KBO/Peppol Search */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={form.vat || ''}
                                onChange={(e) => update('vat', e.target.value)}
                                placeholder="BTW-nummer invullen voor auto-lookup..."
                                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                            />
                        </div>
                        <button
                            onClick={handlePeppolSearch}
                            disabled={isSearching || !form.vat?.trim()}
                            className="px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 text-white disabled:opacity-40"
                            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                        >
                            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                            KBO Lookup
                        </button>
                    </div>
                    {searchError && <p className="text-xs text-red-500 mt-1">{searchError}</p>}
                </div>

                {/* Fields */}
                <div className="px-6 py-3 grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                    {FIELD_DEFS.map(f => (
                        <div key={f.id} className={f.id === 'notes' || f.id === 'title' ? 'col-span-2' : ''}>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-0.5 block">{f.label}</label>
                            <input
                                type={f.type}
                                value={form[f.id] || ''}
                                onChange={(e) => update(f.id, e.target.value)}
                                placeholder={f.placeholder}
                                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                            />
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-black/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                    >
                        Annuleren
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!form.title?.trim()}
                        className="px-5 py-2 text-xs font-bold rounded-lg text-white transition-all disabled:opacity-40 hover:opacity-90"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        Klant aanmaken
                    </button>
                </div>
            </div>
        </div>
    );
}
