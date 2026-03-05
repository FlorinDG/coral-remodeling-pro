"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject, updateProject, deleteProject } from '@/app/actions/cms';
import { Plus, Trash2, Image as ImageIcon, ArrowLeft, Save, MapPin, Type, LayoutDashboard } from 'lucide-react';
import Image from 'next/image';

interface ProjectImage {
    url: string;
    captionEn?: string | null;
    isBefore: boolean;
    order: number;
}

interface ProjectData {
    id?: string;
    titleEn: string;
    titleNl?: string | null;
    titleFr?: string | null;
    titleRo?: string | null;
    locationEn: string;
    locationNl?: string | null;
    locationFr?: string | null;
    locationRo?: string | null;
    order: number;
    images: ProjectImage[];
}

interface ProjectFormProps {
    initialData?: ProjectData;
}

export default function ProjectForm({ initialData }: ProjectFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'en' | 'nl' | 'fr' | 'ro'>('en');
    const [formData, setFormData] = useState<ProjectData>(initialData || {
        titleEn: '',
        locationEn: '',
        order: 0,
        images: []
    });

    const languages = [
        { key: 'en', label: 'English' },
        { key: 'nl', label: 'Dutch' },
        { key: 'fr', label: 'French' },
        { key: 'ro', label: 'Romanian' },
    ] as const;

    const handleAddImage = () => {
        const url = prompt('Image URL:');
        if (!url) return;
        setFormData({
            ...formData,
            images: [...formData.images, { url, isBefore: false, order: formData.images.length }]
        });
    };

    const handleRemoveImage = (index: number) => {
        const newImages = [...formData.images];
        newImages.splice(index, 1);
        setFormData({ ...formData, images: newImages });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (formData.id) {
                await updateProject(formData.id, formData as any);
            } else {
                await createProject(formData as any);
            }
            router.push('/admin/projects');
            router.refresh();
        } catch (error) {
            alert('Failed to save project');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!formData.id || !confirm('Are you sure you want to delete this project?')) return;
        setLoading(true);
        try {
            await deleteProject(formData.id);
            router.push('/admin/projects');
            router.refresh();
        } catch (error) {
            alert('Failed to delete project');
        } finally {
            setLoading(false);
        }
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
                    <h2 className="text-xl font-bold">{formData.id ? 'Edit Project' : 'New Project'}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {formData.id && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                            title="Delete Project"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#d35400] hover:bg-[#e67e22] text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-[#d35400]/20 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> {loading ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                </div>
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
                                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === lang.key ? 'bg-white dark:bg-white/10 text-[#d35400] shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>

                    {/* Localized Form Fields */}
                    <div className="bg-white dark:bg-white/[0.02] p-8 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <Type className="w-3.5 h-3.5" /> Title ({activeTab.toUpperCase()})
                                </label>
                                <input
                                    type="text"
                                    value={(formData as any)[`title${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || ''}
                                    onChange={e => setFormData({ ...formData, [`title${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`]: e.target.value })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors font-bold"
                                    placeholder={`Project name in ${activeTab}...`}
                                    required={activeTab === 'en'}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5" /> Location ({activeTab.toUpperCase()})
                                </label>
                                <input
                                    type="text"
                                    value={(formData as any)[`location${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`] || ''}
                                    onChange={e => setFormData({ ...formData, [`location${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`]: e.target.value })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    placeholder="e.g. Antwerp, Belgium..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Gallery Images */}
                    <div className="bg-white dark:bg-white/[0.02] p-8 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-6 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4">
                            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5" /> Project Gallery
                            </h3>
                            <button
                                type="button"
                                onClick={handleAddImage}
                                className="text-[10px] font-bold text-[#d35400] hover:text-[#e67e22] uppercase tracking-widest transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Image URL
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {formData.images.map((image, idx) => (
                                <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-white/10">
                                    <Image src={image.url} alt={`Preview ${idx}`} fill className="object-cover transition-transform group-hover:scale-110 duration-500" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newImages = [...formData.images];
                                                newImages[idx].isBefore = !newImages[idx].isBefore;
                                                setFormData({ ...formData, images: newImages });
                                            }}
                                            className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border shadow-lg transition-all ${image.isBefore ? 'bg-[#d35400] border-[#d35400] text-white' : 'bg-white/10 border-white/20 text-white'}`}
                                        >
                                            {image.isBefore ? 'BEFORE PIC' : 'AFTER PIC'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="p-2.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all transform scale-90 group-hover:scale-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                                        <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest bg-black/20 backdrop-blur-md px-2 py-0.5 rounded-full">
                                            #{idx + 1}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={handleAddImage}
                                className="aspect-square rounded-2xl border-2 border-dashed border-neutral-200 dark:border-white/5 flex flex-col items-center justify-center gap-2 text-neutral-400 hover:border-[#d35400] hover:text-[#d35400] transition-all bg-neutral-50/50 dark:bg-white/[0.01]"
                            >
                                <Plus className="w-8 h-8 opacity-20" />
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Add Media</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar Configuration */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-3xl border border-neutral-200 dark:border-white/10 space-y-6 shadow-sm">
                        <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-200 dark:border-white/10 pb-4">
                            <LayoutDashboard className="w-3.5 h-3.5" /> Project Config
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-[#d35400] outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#d35400] rounded-3xl p-6 text-white shadow-lg shadow-[#d35400]/20 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-2 opacity-80">Helpful Tip</h3>
                            <p className="text-[11px] leading-relaxed mb-4">
                                Use high-quality "Before" and "After" images to showcase the full impact of your luxury transformations.
                            </p>
                            <div className="w-full aspect-video rounded-xl bg-black/20 flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 opacity-20" />
                            </div>
                        </div>
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
                    </div>
                </div>
            </div>
        </form>
    );
}
