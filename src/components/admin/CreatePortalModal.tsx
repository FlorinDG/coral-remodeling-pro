"use client";

import { useState } from 'react';
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
    const [formData, setFormData] = useState({
        clientName: '',
        clientEmail: '',
        projectTitle: '',
        budget: '',
        paidAmount: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/portals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
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
                        className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[#d35400] outline-none transition-all"
                    />
                    <input
                        type="email"
                        placeholder="Client Email"
                        required
                        value={formData.clientEmail}
                        onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[#d35400] outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Project Details</label>
                    <input
                        type="text"
                        placeholder="Project Title (e.g. Bathroom Renovation)"
                        value={formData.projectTitle}
                        onChange={e => setFormData({ ...formData, projectTitle: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[#d35400] outline-none transition-all"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Total Budget (€)"
                            value={formData.budget}
                            onChange={e => setFormData({ ...formData, budget: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[#d35400] outline-none transition-all"
                        />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Paid Amount (€)"
                            value={formData.paidAmount}
                            onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-[#d35400] outline-none transition-all"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#d35400] hover:bg-neutral-900 dark:hover:bg-white dark:hover:text-black text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-[#d35400]/20 disabled:opacity-50 mt-4"
                >
                    {loading ? 'CREATING...' : 'CREATE PORTAL'}
                </button>
            </form>
        </Modal>
    );
}
