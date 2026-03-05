"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from "@/i18n/routing";
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
    const router = useRouter();
    const [services, setServices] = useState(initialServices);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Professional Services</h2>
                    <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">Total: {services.length}</p>
                </div>
                <Link
                    href="/admin/services/new"
                    className="bg-[#d35400] hover:bg-[#e67e22] text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-[#d35400]/20"
                >
                    <Plus className="w-4 h-4" />
                    ADD SERVICE
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {services.sort((a, b) => a.order - b.order).map((service) => (
                    <div key={service.id} className="group bg-white dark:bg-white/[0.02] rounded-3xl border border-neutral-200 dark:border-white/10 overflow-hidden hover:border-[#d35400]/30 transition-all flex flex-col shadow-sm">
                        <div className="aspect-[4/3] relative bg-neutral-900">
                            <Image src={service.image} alt={service.titleEn} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-md w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg">
                                {service.icon}
                            </div>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Link
                                    href={`/admin/services/${service.id}`}
                                    className="p-3 bg-white text-black rounded-full hover:bg-[#d35400] hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-300"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </Link>
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
                                    {['en', 'nl', 'fr', 'ro'].map(l => (
                                        <span key={l} className={`text-[8px] font-bold uppercase ${(service as any)[`title${l.charAt(0).toUpperCase() + l.slice(1)}`] ? 'text-[#d35400]' : 'text-neutral-300'}`}>{l}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
