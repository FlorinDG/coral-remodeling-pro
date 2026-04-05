"use client";

import { useState } from 'react';
import { Settings, Save, Lock, Euro } from 'lucide-react';

interface PortalSettingsProps {
    portal: {
        id: string;
        budget: number;
        paidAmount: number;
        status: string;
    };
}

export default function PortalSettings({ portal }: PortalSettingsProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        budget: portal.budget.toString(),
        paidAmount: portal.paidAmount.toString(),
        password: '',
        status: portal.status
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/portals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: portal.id,
                    budget: parseFloat(formData.budget),
                    paidAmount: parseFloat(formData.paidAmount),
                    status: formData.status,
                    password: formData.password || undefined
                })
            });
            if (!res.ok) throw new Error();
            alert('Settings updated successfully');
            window.location.reload();
        } catch (error) {
            alert('Failed to update settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-morphism p-6 rounded-3xl border border-white/10 h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Settings className="w-5 h-5 text-[var(--brand-color,#d35400)]" /> Portal Settings
                </h3>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> Budget
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.budget}
                            onChange={e => setFormData({ ...formData, budget: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> Paid Amount
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.paidAmount}
                            onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Update Password
                    </label>
                    <input
                        type="password"
                        placeholder="Leave blank to keep current"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-colors"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1">Status</label>
                    <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color,#d35400)] outline-none transition-colors"
                    >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ON_HOLD">ON HOLD</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-white text-black hover:bg-neutral-200 py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all mt-4"
                >
                    <Save className="w-4 h-4" /> {loading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
            </div>
        </div>
    );
}
