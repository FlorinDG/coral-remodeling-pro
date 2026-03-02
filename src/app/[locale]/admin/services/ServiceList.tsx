"use client";

import { useState } from 'react';
import { updateService } from '@/app/actions/cms';
import { Edit2, ExternalLink, GripVertical } from 'lucide-react';
import Image from 'next/image';

interface ServiceListProps {
    initialServices: import("@prisma/client").CMS_Service[];
}

export default function ServiceList({ initialServices }: ServiceListProps) {
    const [services, setServices] = useState(initialServices);

    return (
        <div className="grid gap-4">
            {services.map((service) => (
                <div key={service.id} className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10 flex items-center justify-between group hover:border-[#d35400]/30 transition-all">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-white/10">
                            <Image src={service.image} alt={service.titleEn} fill className="object-cover" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{service.icon}</span>
                                <h3 className="font-bold text-lg">{service.titleEn}</h3>
                            </div>
                            <p className="text-xs text-[#d35400] font-bold uppercase tracking-widest mt-1 italic opacity-70">
                                /{service.slug}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-3 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors text-neutral-500 hover:text-[#d35400]">
                            <Edit2 className="w-5 h-5" />
                        </button>
                        <a
                            href={`/services/${service.slug}`}
                            target="_blank"
                            className="p-3 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors text-neutral-500 hover:text-[#d35400]"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            ))}

            <button className="mt-8 w-full border-2 border-dashed border-neutral-200 dark:border-white/10 rounded-3xl py-8 text-neutral-500 font-bold uppercase tracking-widest hover:border-[#d35400] hover:text-[#d35400] transition-all">
                + Add New Service
            </button>
        </div>
    );
}
