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
        <form onSubmit={handleSubmit} className="space-y-12">
            {/* Language Switcher */}
            <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-white/5 rounded-2xl w-fit sticky top-20 z-30 backdrop-blur-md shadow-lg border border-neutral-200 dark:border-white/10">
                {(['en', 'nl', 'fr', 'ro'] as const).map((lang) => (
                    <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveLang(lang)}
                        className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeLang === lang
                            ? 'bg-[#d35400] text-white shadow-lg'
                            : 'hover:bg-neutral-200 dark:hover:bg-white/10'
                            }`}
                    >
                        {lang}
                    </button>
                ))}
            </div>

            {Object.entries(groups).map(([groupName, keys]) => (
                <div key={groupName} className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Globe className="w-5 h-5 text-neutral-400" />
                        {groupName} Section
                    </h3>
                    <div className="grid gap-6">
                        {keys.map((key) => (
                            <div key={key} className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-4">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                    {key.replace(`${groupName}.`, '')}
                                </label>
                                {key.includes('description') ? (
                                    <textarea
                                        value={formData[key]?.[activeLang] || ''}
                                        onChange={(e) => handleUpdate(key, activeLang, e.target.value)}
                                        rows={4}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-[#d35400] transition-all resize-none font-medium"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={formData[key]?.[activeLang] || ''}
                                        onChange={(e) => handleUpdate(key, activeLang, e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-6 h-14 outline-none focus:border-[#d35400] transition-all font-bold"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="fixed bottom-8 right-8 z-50">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-3 bg-[#d35400] hover:bg-[#e67e22] text-white px-10 py-5 rounded-2xl font-bold shadow-2xl shadow-[#d35400]/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    PUBLISH CHANGES
                </button>
            </div>
        </form>
    );
}
