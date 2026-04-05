"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createService, updateService } from '@/app/actions/cms';
import { ArrowLeft, Save, Plus, Trash2, LayoutDashboard, Type, AlignLeft, List } from 'lucide-react';

interface ServiceData {
    id?: string;
    slug: string;
    titleEn: string;
    titleNl?: string | null;
    titleFr?: string | null;
    titleRo?: string | null;
    subtitleEn?: string | null;
    subtitleNl?: string | null;
    subtitleFr?: string | null;
    subtitleRo?: string | null;
    descriptionEn: string;
    descriptionNl?: string | null;
    descriptionFr?: string | null;
    descriptionRo?: string | null;
    fullDescriptionEn: string;
    fullDescriptionNl?: string | null;
    fullDescriptionFr?: string | null;
    fullDescriptionRo?: string | null;
    image: string;
    icon: string;
    featuresEn: string[];
    featuresNl?: string[];
    featuresFr?: string[];
    featuresRo?: string[];
    order: number;
}

interface ServiceFormProps {
    initialData?: ServiceData;
}

export default function ServiceForm({ initialData }: ServiceFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'en' | 'nl' | 'fr' | 'ro'>('en');
    const [formData, setFormData] = useState<ServiceData>(initialData || {
        slug: '',
        titleEn: '',
        descriptionEn: '',
        fullDescriptionEn: '',
        image: '',
        icon: '',
        featuresEn: [],
        order: 0,
    });

    const languages = [
        { key: 'en', label: 'English' },
        { key: 'nl', label: 'Dutch' },
        { key: 'fr', label: 'French' },
        { key: 'ro', label: 'Romanian' },
    ] as const;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (formData.id) {
                await updateService(formData.id, formData as any);
            } else {
                await createService(formData as any);
            }
            router.push('/admin/services');
            router.refresh();
        } catch (error) {
            alert('Failed to save service');
        } finally {
            setLoading(false);
        }
    };

    const handleFeatureAdd = (lang: string) => {
        const key = `features${lang.charAt(0).toUpperCase() + lang.slice(1)}` as keyof ServiceData;
        const currentFeatures = (formData[key] as string[]) || [];
        setFormData({ ...formData, [key]: [...currentFeatures, ""] });
    };

    const handleFeatureChange = (lang: string, index: number, value: string) => {
        const key = `features${lang.charAt(0).toUpperCase() + lang.slice(1)}` as keyof ServiceData;
        const currentFeatures = [...((formData[key] as string[]) || [])];
        currentFeatures[index] = value;
        setFormData({ ...formData, [key]: currentFeatures });
    };

    const handleFeatureRemove = (lang: string, index: number) => {
        const key = `features${lang.charAt(0).toUpperCase() + lang.slice(1)}` as keyof ServiceData;
        const currentFeatures = [...((formData[key] as string[]) || [])];
        currentFeatures.splice(index, 1);
        setFormData({ ...formData, [key]: currentFeatures });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl pb-24">
            {/* Action Bar */}
            <div className="flex items-center justify-between sticky top-12 z-10 bg-white/50 dark:bg-black/50 backdrop-blur-md py-4 -mx-6 px-6 border-b border-neutral-200 dark:border-white/5">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-neutral-500" />
                    </button>
                    <h2 className="text-xl font-bold">{formData.id ? 'Edit Service' : 'New Service'}</h2>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    <Save className="w-4 h-4" /> {loading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Localization Tabs */}
                    <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-white/5 rounded-2xl w-fit">
                        {languages.map((lang) => (
                            <button
                                key={lang.key}
                                type="button"
                                onClick={() => setActiveTab(lang.key)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === lang.key ? 'bg-white dark:bg-white/10 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
                                style={activeTab === lang.key ? { color: 'var(--brand-color, #d35400)' } : {}}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>

                    {/* Localized Form Fields */}
                    <div className="bg-white dark:bg-white/[0.02] p-8 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-8 shadow-sm">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                        <Type className="w-3.5 h-3.5" /> Title ({activeTab.toUpperCase()})
                                    </label>
                                    <input
                                        type="text"
                                        value={(formData as any)[`title${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || ''}
                                        onChange={e => setFormData({ ...formData, [`title${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`]: e.target.value })}
                                        className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[var(--brand-color)] outline-none transition-colors font-bold"
                                        placeholder={`Strategic title in ${activeTab}...`}
                                        required={activeTab === 'en'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                        <Type className="w-3.5 h-3.5" /> Subtitle ({activeTab.toUpperCase()})
                                    </label>
                                    <input
                                        type="text"
                                        value={(formData as any)[`subtitle${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || ''}
                                        onChange={e => setFormData({ ...formData, [`subtitle${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`]: e.target.value })}
                                        className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[var(--brand-color)] outline-none transition-colors"
                                        placeholder="Catchy subtitle..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <AlignLeft className="w-3.5 h-3.5" /> Brief Description ({activeTab.toUpperCase()})
                                </label>
                                <textarea
                                    value={(formData as any)[`description${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || ''}
                                    onChange={e => setFormData({ ...formData, [`description${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`]: e.target.value })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[var(--brand-color)] outline-none transition-colors min-h-[100px] resize-none"
                                    placeholder="Used in service grid cards..."
                                    required={activeTab === 'en'}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <AlignLeft className="w-3.5 h-3.5" /> Full Content ({activeTab.toUpperCase()})
                                </label>
                                <textarea
                                    value={(formData as any)[`fullDescription${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || ''}
                                    onChange={e => setFormData({ ...formData, [`fullDescription${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`]: e.target.value })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[var(--brand-color)] outline-none transition-colors min-h-[200px] resize-y"
                                    placeholder="Detailed marketing content for the service page..."
                                    required={activeTab === 'en'}
                                />
                            </div>
                        </div>

                        {/* Features List */}
                        <div className="pt-6 border-t border-neutral-200 dark:border-white/10 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <List className="w-3.5 h-3.5" /> Features ({activeTab.toUpperCase()})
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleFeatureAdd(activeTab)}
                                    className="text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 hover:opacity-80"
                                    style={{ color: 'var(--brand-color, #d35400)' }}
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Feature
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {((formData as any)[`features${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || []).map((feature: string, idx: number) => (
                                    <div key={idx} className="group relative">
                                        <input
                                            type="text"
                                            value={feature}
                                            onChange={e => handleFeatureChange(activeTab, idx, e.target.value)}
                                            className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color)] outline-none transition-colors pr-10"
                                            placeholder="Feature highlight..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleFeatureRemove(activeTab, idx)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {((formData as any)[`features${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || []).length === 0 && (
                                    <div className="col-span-full py-8 text-center border-2 border-dashed border-neutral-200 dark:border-white/5 rounded-2xl text-neutral-400 text-xs italic">
                                        No features added yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Config Area */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-6 shadow-sm">
                        <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-200 dark:border-white/10 pb-4">
                            <LayoutDashboard className="w-3.5 h-3.5" /> Configuration
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">URL Slug</label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color)] outline-none transition-colors font-mono"
                                    placeholder="e.g. kitchen-remodeling"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Emoji Icon</label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color)] outline-none transition-colors text-xl"
                                    placeholder="🏗️"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[var(--brand-color)] outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-4 shadow-sm">
                        <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            Featured Image
                        </h3>
                        <div className="aspect-video relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-white/10 group">
                            {formData.image ? (
                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 gap-2">
                                    <Plus className="w-8 h-8 opacity-20" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">No Image Set</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const url = prompt('Image URL:');
                                        if (url) setFormData({ ...formData, image: url });
                                    }}
                                    className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                                >
                                    Change URL
                                </button>
                            </div>
                        </div>
                        <input
                            type="text"
                            value={formData.image}
                            onChange={e => setFormData({ ...formData, image: e.target.value })}
                            className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-[10px] focus:border-[var(--brand-color)] outline-none transition-colors font-mono"
                            placeholder="Image URL..."
                            required
                        />
                    </div>
                </div>
            </div>
        </form>
    );
}
