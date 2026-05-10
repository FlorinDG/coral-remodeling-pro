"use client";

import React, { useState } from 'react';
import { X, FolderKanban } from 'lucide-react';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (pageId: string) => void;
    createPage: (dbId: string, props: Record<string, any>) => any;
    projectDbId: string;
    preselectedClientId?: string;
}

const FIELD_DEFS = [
    { id: 'title',              label: 'Project Naam',    type: 'text', placeholder: 'Nieuw project', required: true, full: true },
    { id: 'prop-location',      label: 'Locatie',         type: 'text', placeholder: 'Adres werf' },
    { id: 'prop-budget',        label: 'Intern Budget',   type: 'number', placeholder: '0.00' },
    { id: 'prop-start-date',    label: 'Geplande Start',  type: 'date', placeholder: '' },
    { id: 'prop-end-date',      label: 'Geplande Einde',  type: 'date', placeholder: '' },
];

export default function CreateProjectModal({ isOpen, onClose, onCreated, createPage, projectDbId, preselectedClientId }: CreateProjectModalProps) {
    const [form, setForm] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = () => {
        if (!form.title?.trim()) return;
        const props: Record<string, any> = {
            ...form,
            'prop-execution-status': 'opt-to-do',
            'prop-financial-status': 'opt-quote',
        };
        if (preselectedClientId) {
            props['prop-client'] = [preselectedClientId];
        }
        if (form['prop-budget']) {
            props['prop-budget'] = parseFloat(form['prop-budget']) || 0;
        }
        const page = createPage(projectDbId, props);
        if (page) {
            onCreated(page.id);
            onClose();
            setForm({});
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-white/5">
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <FolderKanban className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                        Nieuw project aanmaken
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors">
                        <X className="w-4 h-4 text-neutral-400" />
                    </button>
                </div>

                {/* Fields */}
                <div className="px-6 py-4 grid grid-cols-2 gap-3">
                    {FIELD_DEFS.map(f => (
                        <div key={f.id} className={f.full ? 'col-span-2' : ''}>
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
                        Project aanmaken
                    </button>
                </div>
            </div>
        </div>
    );
}
