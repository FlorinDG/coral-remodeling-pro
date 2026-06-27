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
    const [isUploading, setIsUploading] = useState(false);

    const handleAddDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        const fileInput = document.getElementById('doc-upload') as HTMLInputElement;
        const files = fileInput?.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const fd = new FormData();
            fd.append('portalId', portalId);
            
            const pwd = sessionStorage.getItem(`portal_auth_${portalId}`);
            if (pwd && pwd !== 'true') {
                fd.append('password', pwd);
            }

            for (let i = 0; i < files.length; i++) {
                fd.append('file', files[i]);
            }

            const res = await fetch('/api/portals/documents', {
                method: 'POST',
                body: fd
            });
            
            const result = await res.json();
            if (result.success && result.documents) {
                setDocs([...docs, ...result.documents]);
                setIsAdding(false);
            } else {
                console.error(result.error);
                alert(`Upload failed: ${result.error}`);
            }
        } catch (err) {
            console.error(err);
            alert('Upload failed.');
        } finally {
            setIsUploading(false);
        }
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
                                id="doc-upload"
                                type="file"
                                multiple
                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75d00] outline-none transition-colors text-neutral-700 dark:text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#d75d00]/10 file:text-[#d75d00] hover:file:bg-[#d75d00]/20"
                            />
                            <button type="submit" disabled={isUploading} className="w-full bg-[#d75d00] text-white py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-neutral-900 transition-all disabled:opacity-50">
                                {isUploading ? 'Uploading...' : 'Add Document'}
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
