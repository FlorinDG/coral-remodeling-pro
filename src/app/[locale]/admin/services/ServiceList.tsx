"use client";

import { useState } from 'react';
import { updateService, createService, deleteService } from '@/app/actions/cms';
import { Edit2, ExternalLink, Plus, Trash2, X, Save, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface Service {
    id: string;
    slug: string;
    titleEn: string;
    titleNl?: string | null;
    titleFr?: string | null;
    titleRo?: string | null;
    icon: string;
    image: string;
    order: number;
}

interface ServiceListProps {
    initialServices: Service[];
}

export default function ServiceList({ initialServices }: ServiceListProps) {
    const [services, setServices] = useState(initialServices);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleEdit = (service: Service) => {
        setEditingService(service);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingService?.id) {
                await updateService(editingService.id, editingService as any);
                setServices(services.map(s => s.id === editingService.id ? editingService : s));
            } else if (editingService) {
                const res = await createService(editingService as any);
                // @ts-ignore
                if (res.success) window.location.reload();
            }
            setEditingService(null);
            setIsAdding(false);
        } catch (error) {
            alert('Failed to save service');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Professional Services</h2>
                    <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">Total: {services.length}</p>
                </div>
                <button
                    onClick={() => {
                        setEditingService({ id: '', slug: '', titleEn: '', icon: '🏗️', image: '', order: services.length });
                        setIsAdding(true);
                    }}
                    className="bg-[#d35400] hover:bg-[#e67e22] text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-[#d35400]/20"
                >
                    <Plus className="w-4 h-4" />
                    ADD SERVICE
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {services.sort((a, b) => a.order - b.order).map((service) => (
                    <div key={service.id} className="group glass-morphism rounded-3xl border border-neutral-200 dark:border-white/10 overflow-hidden hover:border-[#d35400]/30 transition-all flex flex-col">
                        <div className="aspect-[4/3] relative bg-neutral-900">
                            <Image src={service.image} alt={service.titleEn} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-md w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg">
                                {service.icon}
                            </div>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => handleEdit(service)}
                                    className="p-3 bg-white text-black rounded-full hover:bg-[#d35400] hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-300"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <a
                                    href={`/services/${service.slug}`}
                                    target="_blank"
                                    className="p-3 bg-white text-black rounded-full hover:bg-[#d35400] hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-300 delay-75"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <h3 className="font-bold text-neutral-900 dark:text-white">{service.titleEn}</h3>
                            <p className="text-[10px] text-[#d35400] font-bold uppercase tracking-widest mt-1 opacity-70">/{service.slug}</p>
                            <div className="mt-auto pt-4 flex items-center justify-between border-t border-neutral-100 dark:border-white/5">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Order: {service.order}</span>
                                <div className="flex gap-1">
                                    {['en', 'nl'].map(l => (
                                        <span key={l} className={`text-[8px] font-bold uppercase ${service.titleEn && (l === 'en' || (service as any).titleNl) ? 'text-green-500' : 'text-neutral-300'}`}>{l}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-3xl border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="font-bold text-lg">{isAdding ? 'New Service' : 'Edit Service'}</h3>
                            <button onClick={() => setEditingService(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Title (EN)</label>
                                    <input
                                        type="text"
                                        value={editingService.titleEn}
                                        onChange={e => setEditingService({ ...editingService, titleEn: e.target.value })}
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d35400]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Slug</label>
                                    <input
                                        type="text"
                                        value={editingService.slug}
                                        onChange={e => setEditingService({ ...editingService, slug: e.target.value })}
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d35400]"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Icon (Emoji/Lucide)</label>
                                    <input
                                        type="text"
                                        value={editingService.icon}
                                        onChange={e => setEditingService({ ...editingService, icon: e.target.value })}
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d35400]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Display Order</label>
                                    <input
                                        type="number"
                                        value={editingService.order}
                                        onChange={e => setEditingService({ ...editingService, order: parseInt(e.target.value) })}
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d35400]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Image URL</label>
                                <input
                                    type="text"
                                    value={editingService.image}
                                    onChange={e => setEditingService({ ...editingService, image: e.target.value })}
                                    className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d35400]"
                                    required
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[#d35400] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#e67e22] transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {loading ? 'SAVING...' : 'SAVE CHANGES'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
