"use client";

import { useState } from 'react';
import { updateSiteContent } from '@/app/actions/cms';
import { Save, Loader2, Globe } from 'lucide-react';

interface ContentFormProps {
    initialData: import("@/lib/cms").SiteContentMap;
    groups: Record<string, string[]>;
}

export default function ContentForm({ initialData, groups }: ContentFormProps) {
    const [formData, setFormData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(false);
    const [activeLang, setActiveLang] = useState<'en' | 'nl' | 'fr' | 'ro'>('en');

    const handleUpdate = (key: string, lang: string, value: string) => {
        setFormData({
            ...formData,
            [key]: {
                ...formData[key],
                [lang]: value
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateSiteContent(formData);
            alert("Content updated successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to update content.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Language Switcher - More compact */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-white/5 rounded-xl w-fit sticky top-20 z-30 backdrop-blur-md shadow-sm border border-neutral-200 dark:border-white/10">
                {(['en', 'nl', 'fr', 'ro'] as const).map((lang) => (
                    <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveLang(lang)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeLang === lang
                            ? 'bg-[var(--brand-color,#d35400)] text-white shadow-sm'
                            : 'hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500'
                            }`}
                    >
                        {lang}
                    </button>
                ))}
            </div>

            <div className="space-y-10">
                {Object.entries(groups).map(([groupName, keys]) => (
                    <div key={groupName} className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-white/5 pb-2">
                            <Globe className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                                {groupName}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {keys.map((key) => {
                                const isImage = key.toLowerCase().includes('image') || key.toLowerCase().includes('url') || key.toLowerCase().includes('logo') || key.toLowerCase().includes('bg');
                                const isLarge = key.toLowerCase().includes('description') || key.toLowerCase().includes('content') || key.toLowerCase().includes('address');

                                // Full width for large text and images, half for others
                                const gridClass = (isLarge || isImage) ? "col-span-1 md:col-span-2" : "col-span-1";

                                return (
                                    <div key={key} className={`${gridClass} bg-white dark:bg-white/[0.02] p-4 rounded-2xl border border-neutral-200 dark:border-white/5 space-y-2 hover:border-[var(--brand-color,#d35400)]/20 transition-colors`}>
                                        <label className="block text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                                            {key.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim()}
                                            <span className="text-neutral-300 dark:text-neutral-600 ml-2 lowercase font-normal italic">({key})</span>
                                        </label>

                                        {isImage ? (
                                            <div className="flex gap-4 items-center">
                                                <div className="w-16 h-16 rounded-xl bg-neutral-100 dark:bg-black border border-neutral-200 dark:border-white/10 overflow-hidden relative flex-shrink-0 group">
                                                    {formData[key]?.[activeLang] ? (
                                                        <img src={formData[key]?.[activeLang]} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-700">
                                                            <Globe className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <input
                                                        type="text"
                                                        value={formData[key]?.[activeLang] || ''}
                                                        onChange={(e) => handleUpdate(key, activeLang, e.target.value)}
                                                        placeholder="Image URL"
                                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-10 outline-none focus:border-[var(--brand-color)] transition-all font-mono text-[11px]"
                                                    />
                                                </div>
                                            </div>
                                        ) : isLarge ? (
                                            <textarea
                                                value={formData[key]?.[activeLang] || ''}
                                                onChange={(e) => handleUpdate(key, activeLang, e.target.value)}
                                                rows={3}
                                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[var(--brand-color)] transition-all resize-none text-sm leading-relaxed"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={formData[key]?.[activeLang] || ''}
                                                onChange={(e) => handleUpdate(key, activeLang, e.target.value)}
                                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-11 outline-none focus:border-[var(--brand-color)] transition-all text-sm font-medium"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-8 right-8 z-50">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 text-white px-8 py-4 rounded-xl font-bold shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-xs tracking-widest uppercase hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Publish Content
                </button>
            </div>
        </form>
    );
}
