"use client";

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useTranslations } from 'next-intl';

interface CreatePortalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreatePortalModal({ isOpen, onClose, onSuccess }: CreatePortalModalProps) {
    const t = useTranslations('Admin.portals');
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
    
    const [createProject, setCreateProject] = useState(false);
    const [formData, setFormData] = useState({
        clientName: '',
        clientEmail: '',
        projectTitle: '', // For new project
        linkedProjectId: '', // For existing project
        budget: '',
        paidAmount: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetch('/api/hr/erp-projects')
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) setProjects(data);
                })
                .catch(e => console.error(e));
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/portals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    createProject,
                    budget: formData.budget ? parseFloat(formData.budget) : 0,
                    paidAmount: formData.paidAmount ? parseFloat(formData.paidAmount) : 0
                })
            });
            if (!res.ok) throw new Error();
            onSuccess();
            onClose();
        } catch (error) {
            alert('Failed to create portal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Portal">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Client Information</label>
                    <input
                        type="text"
                        placeholder="Client Name"
                        required
                        value={formData.clientName}
                        onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-all"
                    />
                    <input
                        type="email"
                        placeholder="Client Email"
                        required
                        value={formData.clientEmail}
                        onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Project Linking</label>
                        <button 
                            type="button" 
                            onClick={() => setCreateProject(!createProject)}
                            className="text-xs text-[var(--brand-color,#d35400)] font-semibold"
                        >
                            {createProject ? 'Attach Existing Project' : '+ Create New Project'}
                        </button>
                    </div>

                    {createProject ? (
                        <input
                            type="text"
                            placeholder="New Project Title (e.g. Bathroom Renovation)"
                            required
                            value={formData.projectTitle}
                            onChange={e => setFormData({ ...formData, projectTitle: e.target.value, linkedProjectId: '' })}
                            className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-all"
                        />
                    ) : (
                        <select
                            required
                            value={formData.linkedProjectId}
                            onChange={e => {
                                const selected = projects.find(p => p.id === e.target.value);
                                setFormData({ ...formData, linkedProjectId: e.target.value, projectTitle: selected ? selected.name : '' });
                            }}
                            className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-all appearance-none"
                        >
                            <option value="" disabled>Select an existing project...</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Total Budget (€)"
                            value={formData.budget}
                            onChange={e => setFormData({ ...formData, budget: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-all"
                        />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Paid Amount (€)"
                            value={formData.paidAmount}
                            onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-all"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[var(--brand-color,#d35400)] hover:bg-neutral-900 dark:hover:bg-white dark:hover:text-black text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-sm disabled:opacity-50 mt-4"
                >
                    {loading ? 'CREATING...' : 'CREATE PORTAL'}
                </button>
            </form>
        </Modal>
    );
}
