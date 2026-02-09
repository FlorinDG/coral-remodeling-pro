"use client";

import { useState } from 'react';
import { FileText, Download, Plus, File } from 'lucide-react';

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
    const [docs, setDocs] = useState(initialDocs);

    const handleAddDoc = async () => {
        const name = prompt("Document Name:");
        if (!name) return;
        const url = prompt("Document URL (e.g., Dropbox/Google Drive link):");
        if (!url) return;

        // Simple type inference
        const type = url.endsWith('.pdf') ? 'PDF' : 'DOC';

        const res = await fetch('/api/portals/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portalId, name, url, type })
        });
        const doc = await res.json();
        setDocs([...docs, doc]);
    };

    return (
        <div className="glass-morphism p-6 rounded-3xl border border-white/10 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">Documents</h3>
                {!readOnly && (
                    <button onClick={handleAddDoc} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                        <Plus className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-2">
                {docs.length === 0 && <p className="col-span-2 text-neutral-500 italic text-sm text-center py-4">No documents.</p>}
                {docs.map(doc => (
                    <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-white/20 transition-all flex flex-col items-center text-center gap-3 group"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#d35400]/10 flex items-center justify-center group-hover:bg-[#d35400] transition-colors">
                            <FileText className="w-5 h-5 text-[#d35400] group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-xs font-bold truncate w-full">{doc.name}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}
