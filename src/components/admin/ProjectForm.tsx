"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject, updateProject } from '@/app/actions/cms';
import { Plus, Trash2, Image as ImageIcon, ArrowLeft, Save } from 'lucide-react';
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
    const [formData, setFormData] = useState<ProjectData>(initialData || {
        titleEn: '',
        locationEn: '',
        order: 0,
        images: []
    });

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

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl pb-24">
            <div className="flex items-center justify-between sticky top-20 z-10 bg-white/50 dark:bg-black/50 backdrop-blur-md py-4 -mx-4 px-4 rounded-b-2xl">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> BACK
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#d35400] hover:bg-[#e67e22] text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-[#d35400]/20 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" /> {loading ? 'SAVING...' : 'SAVE PROJECT'}
                </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                    <div className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-[#d35400] mb-6">Basic Information</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Project Title (EN)</label>
                                <input
                                    type="text"
                                    value={formData.titleEn}
                                    onChange={e => setFormData({ ...formData, titleEn: e.target.value })}
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Location (EN)</label>
                                <input
                                    type="text"
                                    value={formData.locationEn}
                                    onChange={e => setFormData({ ...formData, locationEn: e.target.value })}
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-6">Translations (Optional)</h3>
                        <div className="space-y-4 opacity-70">
                            {['Nl', 'Fr', 'Ro'].map(lang => (
                                <div key={lang}>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Title ({lang})</label>
                                    <input
                                        type="text"
                                        value={(formData as any)[`title${lang}`] || ''}
                                        onChange={e => setFormData({ ...formData, [`title${lang}`]: e.target.value })}
                                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Images */}
                <div className="space-y-6">
                    <div className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10 min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[#d35400]">Gallery Images</h3>
                            <button
                                type="button"
                                onClick={handleAddImage}
                                className="text-xs font-bold text-neutral-500 hover:text-[#d35400] flex items-center gap-1 uppercase tracking-widest transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add URI
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {formData.images.map((image, idx) => (
                                <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-neutral-900">
                                    <Image src={image.url} alt={`Preview ${idx}`} fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newImages = [...formData.images];
                                                newImages[idx].isBefore = !newImages[idx].isBefore;
                                                setFormData({ ...formData, images: newImages });
                                            }}
                                            className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full border ${image.isBefore ? 'bg-[#d35400] border-[#d35400] text-white' : 'bg-white/10 border-white/20 text-white'}`}
                                        >
                                            {image.isBefore ? 'BEFORE PIC' : 'AFTER PIC'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="p-2 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddImage}
                                className="aspect-square rounded-2xl border-2 border-dashed border-neutral-200 dark:border-white/5 flex flex-col items-center justify-center gap-2 text-neutral-400 hover:border-[#d35400] hover:text-[#d35400] transition-all"
                            >
                                <Plus className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Add Image</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
