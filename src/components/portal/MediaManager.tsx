"use client";

import { useState } from 'react';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Media {
    id: string;
    url: string;
    caption?: string;
}

interface MediaManagerProps {
    portalId: string;
    initialMedia: Media[];
    readOnly?: boolean;
}

export default function MediaManager({ portalId, initialMedia, readOnly = false }: MediaManagerProps) {
    const t = useTranslations('Portal');
    const [media, setMedia] = useState(initialMedia);

    const handleAddMedia = async () => {
        const url = prompt("Image URL:");
        if (!url) return;
        const caption = prompt("Caption (optional):");

        const res = await fetch('/api/portals/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portalId, url, caption })
        });
        const newMedia = await res.json();
        setMedia([...media, newMedia]);
    };

    return (
        <div className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-900 dark:text-white">{t('projectMedia')}</h3>
                {!readOnly && (
                    <button onClick={handleAddMedia} className="p-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-full transition-colors text-neutral-600 dark:text-white">
                        <Plus className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2 h-64 lg:h-auto">
                {media.length === 0 && <p className="col-span-full text-neutral-500 italic text-sm text-center py-4">{t('noMedia')}</p>}
                {media.map((item) => (
                    <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden group bg-neutral-200 dark:bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={item.caption || "Project Image"} className="object-cover w-full h-full opacity-90 dark:opacity-80 group-hover:opacity-100 transition-opacity" />
                        {item.caption && (
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm">
                                <p className="text-[10px] text-white font-bold truncate">{item.caption}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
