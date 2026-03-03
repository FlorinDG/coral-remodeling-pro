"use client";

import { useState } from 'react';
import { updateBanner } from '@/app/actions/cms';
import { Megaphone, Save, Power } from 'lucide-react';

interface BannerData {
    textEn: string;
    textNl?: string | null;
    isActive: boolean;
}

interface PromotionalBannerEditorProps {
    initialData?: BannerData;
}

export default function PromotionalBannerEditor({ initialData }: PromotionalBannerEditorProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<BannerData>(initialData || {
        textEn: '',
        textNl: '',
        isActive: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateBanner(formData);
            alert('Banner updated successfully');
        } catch (error) {
            alert('Failed to update banner');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-morphism p-8 rounded-3xl border border-neutral-200 dark:border-white/10 max-w-2xl bg-[#d35400]/5 border-[#d35400]/10">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-[#d35400] rounded-2xl">
                    <Megaphone className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Promotional Banner</h3>
                    <p className="text-sm text-neutral-500">Display a global alert on the website.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-black/40 rounded-2xl border border-neutral-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.isActive ? 'bg-green-500/10 text-green-500' : 'bg-neutral-100 dark:bg-white/5 text-neutral-400'}`}>
                            <Power className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-bold">{formData.isActive ? 'Active' : 'Inactive'}</p>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Banner Status</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d35400]"></div>
                    </label>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Banner Text (EN)</label>
                        <input
                            type="text"
                            value={formData.textEn}
                            onChange={e => setFormData({ ...formData, textEn: e.target.value })}
                            placeholder="e.g. Special Offer: 20% off on all bathroom renovations until April!"
                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Banner Text (NL)</label>
                        <input
                            type="text"
                            value={formData.textNl || ''}
                            onChange={e => setFormData({ ...formData, textNl: e.target.value })}
                            placeholder="e.g. Speciale aanbieding: 20% korting..."
                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-neutral-900 dark:bg-white dark:text-black py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#d35400] dark:hover:bg-[#d35400] dark:hover:text-white transition-all disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {loading ? 'Updating...' : 'Update Banner Settings'}
                </button>
            </form>
        </div>
    );
}
