"use client";

import { useState } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Document {
    id: string;
    name: string;
    url: string;
    type: string;
}

interface DocumentManagerProps {
    portalId: string;
    initialDocs: Document[];
    readOnly?: boolean;
}

export default function DocumentManager({ portalId, initialDocs, readOnly = false }: DocumentManagerProps) {
    const t = useTranslations('Portal');
    const [docs, setDocs] = useState(initialDocs);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({ name: '', url: '' });

    const handleAddDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.url) return;

        // Simple type inference
        const type = formData.url.endsWith('.pdf') ? 'PDF' : 'DOC';

        const res = await fetch('/api/portals/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portalId, name: formData.name, url: formData.url, type })
        });
        const doc = await res.json();
        setDocs([...docs, doc]);
        setFormData({ name: '', url: '' });
        setIsAdding(false);
    };

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-[2.5rem] border border-neutral-200 dark:border-white/10 p-8 h-full flex flex-col shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-neutral-900 dark:text-white">
                    {t('documents')}
                    <FileText className="w-5 h-5 text-[#d75d00]" />
                </h3>
                {!readOnly && !isAdding && (
                    <button onClick={() => setIsAdding(true)} className="p-2 bg-[#d75d00] text-white rounded-full hover:bg-neutral-900 transition-all">
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-2 pr-2 custom-scrollbar">
                {isAdding && (
                    <div className="glass-morphism p-6 rounded-3xl border border-[#d75d00]/20 animate-in slide-in-from-right-4 duration-300 mb-4">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#d75d00]">New Document</span>
                            <button onClick={() => setIsAdding(false)}><X className="w-4 h-4 text-neutral-400" /></button>
                        </div>
                        <form onSubmit={handleAddDoc} className="space-y-4">
                            <input
                                autoFocus
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Document name..."
                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75d00] outline-none transition-colors"
                            />
                            <input
                                value={formData.url}
                                onChange={e => setFormData({ ...formData, url: e.target.value })}
                                placeholder="Link to document (PDF, Google Drive, etc.)..."
                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75d00] outline-none transition-colors"
                            />
                            <button type="submit" className="w-full bg-[#d75d00] text-white py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-neutral-900 transition-all">
                                Add Document
                            </button>
                        </form>
                    </div>
                )}

                {docs.length === 0 && !isAdding && <p className="text-neutral-500 italic text-sm text-center py-10">{t('noDocs')}</p>}
                <div className="grid grid-cols-2 gap-4">
                    {docs.map(doc => (
                        <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-5 bg-white dark:bg-black/40 rounded-[1.5rem] border border-neutral-200 dark:border-white/10 hover:border-[#d75d00]/50 shadow-sm group transition-all hover:-translate-y-1"
                        >
                            <div className="w-10 h-10 rounded-xl bg-[#d75d00]/10 flex items-center justify-center group-hover:bg-[#d75d00] transition-colors mb-3">
                                <FileText className="w-5 h-5 text-[#d75d00] group-hover:text-white transition-colors" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest truncate w-full group-hover:text-[#d75d00] transition-colors">{doc.name}</span>
                            <div className="mt-2 text-[8px] font-bold text-neutral-400 uppercase tracking-[0.2em]">{doc.type}</div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
