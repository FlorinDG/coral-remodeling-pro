"use client";

import { useState } from 'react';
import { Plus, X, FolderKanban, Loader2 } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';

const createDriveFolder = async (name: string, parentId?: string) => {
    const formData = new FormData();
    formData.append('action', 'create_folder');
    formData.append('name', name);
    if (parentId) formData.append('parentId', parentId);

    const res = await fetch('/api/drive', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Drive fault: ${await res.text()}`);
    const data = await res.json();
    return data.node.id as string;
};

export default function NewProjectButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [statusText, setStatusText] = useState("");

    const [formData, setFormData] = useState({
        name: '',
        budget: '',
        startDate: '',
        targetEndDate: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        setIsLoading(true);
        setStatusText("Saving project record...");

        try {
            // 1. Create the NotionGrid Row directly
            const createPage = useDatabaseStore.getState().createPage;

            setStatusText("Building Google Drive context...");
            // Use the form data for folder creation since it has no ID yet
            const rootProjectId = await createDriveFolder(`Project: ${formData.name}`);

            setStatusText("Scaffolding operational directories...");
            const subfolders = ['Offertes', 'Vorderingen', 'Facturen', 'Bestellingen', 'Suppliers', 'Media'];
            await Promise.all(subfolders.map(folderName => createDriveFolder(folderName, rootProjectId)));

            // Save row to db-1 and inject Drive folder ID linking into memory
            const propertiesToInject: Record<string, any> = {
                'title': formData.name,
                'prop-start-date': formData.startDate || '',
                'prop-end-date': formData.targetEndDate || '',
            };

            if (formData.budget) {
                propertiesToInject['prop-budget'] = parseFloat(formData.budget);
            }

            // Create page synchronously in memory (syncs to postgres behind the scenes)
            createPage('db-1', propertiesToInject);

            setIsOpen(false);
            setFormData({ name: '', budget: '', startDate: '', targetEndDate: '' });
        } catch (error: any) {
            console.error(error);
            alert(`Provisioning Failed: ${error.message}`);
        } finally {
            setIsLoading(false);
            setStatusText("");
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-colors"
                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
            >
                <Plus className="w-4 h-4" />
                New Project
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 dark:border-white/10 overflow-hidden transform transition-all">
                        <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-white/5">
                            <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
                                <FolderKanban className="w-5 h-5 hidden sm:block" style={{ color: 'var(--brand-color, #d35400)' }} />
                                Scaffold New Project
                            </div>
                            <button
                                onClick={() => !isLoading && setIsOpen(false)}
                                disabled={isLoading}
                                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Project Name*</label>
                                <input
                                    type="text"
                                    required
                                    disabled={isLoading}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[var(--brand-color)] outline-none transition-colors font-bold text-neutral-900 dark:text-white"
                                    placeholder="e.g. Master Bedroom Remodel"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Internal Budget (€)</label>
                                <input
                                    type="number"
                                    disabled={isLoading}
                                    value={formData.budget}
                                    onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                    className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[var(--brand-color)] outline-none transition-colors"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Start Date</label>
                                    <input
                                        type="date"
                                        disabled={isLoading}
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[var(--brand-color)] outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Target End</label>
                                    <input
                                        type="date"
                                        disabled={isLoading}
                                        value={formData.targetEndDate}
                                        onChange={e => setFormData({ ...formData, targetEndDate: e.target.value })}
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[var(--brand-color)] outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-white/5 flex flex-col items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={isLoading || !formData.name}
                                    className="w-full text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:opacity-90"
                                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    {isLoading ? 'Processing...' : 'Provision Architecture'}
                                </button>
                                {isLoading && (
                                    <p className="text-xs font-medium text-blue-500 animate-pulse">{statusText}</p>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
