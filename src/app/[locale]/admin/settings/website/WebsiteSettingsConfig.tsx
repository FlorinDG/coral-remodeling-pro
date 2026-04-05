"use client";

import { useState, useEffect } from 'react';
import { updateSiteContent } from '@/app/actions/cms';
import { Save, Loader2, Globe, Shield, Search, Code } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

interface WebsiteSettingsConfigProps {
    initialData: import("@/lib/cms").SiteContentMap;
}

export default function WebsiteSettingsConfig({ initialData }: WebsiteSettingsConfigProps) {
    usePageTitle('Website Settings');
    const [formData, setFormData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(false);

    const handleUpdate = (key: string, value: string) => {
        setFormData({
            ...formData,
            [key]: {
                ...formData[key],
                en: value // Store settings globally under 'en' to avoid locale duplication
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateSiteContent(formData);
            toast.success("Website settings updated successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update website settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const getVal = (key: string) => formData[key]?.en || '';
    const getBool = (key: string) => formData[key]?.en === 'true';

    const handleToggle = (key: string) => {
        handleUpdate(key, getBool(key) ? 'false' : 'true');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl pb-24">

            {/* Global SEO Section */}
            <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/10 px-6 py-4 flex items-center gap-3">
                    <Search className="w-5 h-5" style={{ color: 'var(--brand-color, #d35400)' }} />
                    <h3 className="font-bold text-neutral-900 dark:text-white">Global SEO Configuration</h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Site Title Suffix</label>
                            <input
                                type="text"
                                value={getVal('Settings.SEO.TitleSuffix')}
                                onChange={(e) => handleUpdate('Settings.SEO.TitleSuffix', e.target.value)}
                                placeholder="e.g., | Coral Remodeling - Luxury Contractor"
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-11 outline-none focus:border-[var(--brand-color)] transition-all"
                            />
                            <p className="text-[11px] text-neutral-400">Appended to the end of all page titles to maintain consistent branding.</p>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Global Keywords</label>
                            <textarea
                                value={getVal('Settings.SEO.Keywords')}
                                onChange={(e) => handleUpdate('Settings.SEO.Keywords', e.target.value)}
                                rows={3}
                                placeholder="luxury, remodeling, renovation, general contractor, highest quality"
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[var(--brand-color)] transition-all resize-none"
                            />
                            <p className="text-[11px] text-neutral-400">Comma separated keywords injected into the root layout for wider SEO reach.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compliance Section */}
            <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/10 px-6 py-4 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-neutral-900 dark:text-white">GDPR & Compliance</h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-4 border border-neutral-200 dark:border-white/10 rounded-xl bg-neutral-50 dark:bg-white/[0.02]">
                        <div>
                            <h4 className="font-bold text-sm">Enable GDPR Cookie Consent Banner</h4>
                            <p className="text-xs text-neutral-500 mt-1">Require visitors to explicitly accept tracking cookies (Google Consent Mode v2).</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleToggle('Settings.Compliance.CookieBanner')}
                            className={`w-12 h-6 rounded-full transition-colors relative ${getBool('Settings.Compliance.CookieBanner') ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${getBool('Settings.Compliance.CookieBanner') ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tracking Scripts */}
            <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/10 px-6 py-4 flex items-center gap-3">
                    <Code className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-neutral-900 dark:text-white">Tracking & Analytics Scripts</h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Google Analytics 4 Measurement ID</label>
                            <input
                                type="text"
                                value={getVal('Settings.Tracking.GA4')}
                                onChange={(e) => handleUpdate('Settings.Tracking.GA4', e.target.value)}
                                placeholder="G-XXXXXXXXXX"
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-11 outline-none focus:border-[var(--brand-color)] transition-all font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Google Tag Manager ID</label>
                            <input
                                type="text"
                                value={getVal('Settings.Tracking.GTM')}
                                onChange={(e) => handleUpdate('Settings.Tracking.GTM', e.target.value)}
                                placeholder="GTM-XXXXXXX"
                                className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-11 outline-none focus:border-[var(--brand-color)] transition-all font-mono text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Save Button */}
            <div className="fixed bottom-8 right-8 z-50">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 text-white px-8 py-4 rounded-xl font-bold shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-xs tracking-widest uppercase hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Settings
                </button>
            </div>
        </form>
    );
}
