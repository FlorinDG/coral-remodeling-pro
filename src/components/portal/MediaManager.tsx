"use client";

import { useState } from 'react';
import { Image as ImageIcon, Plus, X, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Media {
    id: string;
    url: string;
    type: string;
    caption?: string | null;
}

interface MediaManagerProps {
    portalId: string;
    initialMedia: Media[];
    readOnly?: boolean;
}

export default function MediaManager({ portalId, initialMedia, readOnly = false }: MediaManagerProps) {
    const t = useTranslations('Portal');
    const [media, setMedia] = useState(initialMedia);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({ url: '', caption: '' });

    const handleAddMedia = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.url) return;

        const res = await fetch('/api/portals/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portalId,
                url: formData.url,
                caption: formData.caption,
                type: 'IMAGE'
            })
        });
        const newMedia = await res.json();
        setMedia([newMedia, ...media]);
        setFormData({ url: '', caption: '' });
        setIsAdding(false);
    };

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-[2.5rem] border border-neutral-200 dark:border-white/10 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-neutral-900 dark:text-white">
                    {t('media')}
                    <ImageIcon className="w-5 h-5 text-[#d75d00]" />
                </h3>
                {!readOnly && !isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-4 py-2 bg-[#d75d00] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-900 transition-all shadow-lg shadow-[#d75d00]/20"
                    >
                        Add Media
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {isAdding && (
                    <div className="glass-morphism p-6 rounded-3xl border border-[#d75d00]/20 animate-in zoom-in-95 duration-200 mb-6 font-bold">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#d75d00]">New Image</span>
                            <button onClick={() => setIsAdding(false)}><X className="w-4 h-4 text-neutral-400" /></button>
                        </div>
                        <form onSubmit={handleAddMedia} className="space-y-4">
                            <input
                                autoFocus
                                value={formData.url}
                                onChange={e => setFormData({ ...formData, url: e.target.value })}
                                placeholder="Image URL..."
                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75d00] outline-none transition-colors"
                            />
                            <input
                                value={formData.caption}
                                onChange={e => setFormData({ ...formData, caption: e.target.value })}
                                placeholder="Caption (optional)..."
                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75d00] outline-none transition-colors"
                            />
                            <button type="submit" className="w-full bg-[#d75d00] text-white py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-neutral-900 transition-all">
                                Upload Photo
                            </button>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                    {media.length === 0 && !isAdding && <p className="col-span-full text-neutral-500 italic text-center py-10 text-sm">{t('noMedia')}</p>}
                    {media.map((item) => (
                        <div key={item.id} className="group relative aspect-[2/1] rounded-2xl overflow-hidden border border-neutral-200 dark:border-white/5 bg-white dark:bg-black/40 shadow-sm hover:shadow-xl hover:shadow-[#d75d00]/5 hover:-translate-y-1 transition-all duration-300">
                            <img
                                src={item.url}
                                alt={item.caption || 'Project media'}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                {item.caption && <p className="text-white text-[10px] font-bold uppercase tracking-widest mb-2 line-clamp-1">{item.caption}</p>}
                                <a
                                    href={item.url}
                                    target="_blank"
                                    className="bg-[#d75d00] text-white p-2 rounded-lg self-end hover:bg-white hover:text-[#d75d00] transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
