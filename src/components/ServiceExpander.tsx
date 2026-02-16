"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// SERVICES array removed to be replaced by dynamic data inside component

import { useTranslations } from 'next-intl';

export default function ServiceExpander() {
    const t = useTranslations('Services');

    const SERVICES = [
        {
            id: 'kitchen-design',
            title: t('kitchen.title'),
            subtitle: t('kitchen.subtitle'),
            description: t('kitchen.description'),
            image: "/images/kitchen-hero.png",
            icon: "🍳"
        },
        {
            id: 'bath-restoration',
            title: t('bath.title'),
            subtitle: t('bath.subtitle'),
            description: t('bath.description'),
            image: "/images/bathroom-hero.png",
            icon: "🛁"
        },
        {
            id: 'custom-additions',
            title: t('additions.title'),
            subtitle: t('additions.subtitle'),
            description: t('additions.description'),
            image: "/images/kitchen-portfolio-2.png",
            icon: "🏠"
        },
        {
            id: 'whole-home',
            title: t('wholeHome.title'),
            subtitle: t('wholeHome.subtitle'),
            description: t('wholeHome.description'),
            image: "/images/bathroom-portfolio-2.png",
            icon: "✨"
        }
    ];

    const [activeId, setActiveId] = useState<string | null>(SERVICES[0].id);

    return (
        <div className="w-full flexflex-col gap-8">
            {/* Desktop View */}
            <div className="hidden md:flex h-[600px] gap-4">
                {SERVICES.map((service) => {
                    const isActive = activeId === service.id;
                    return (
                        <motion.div
                            key={service.id}
                            onHoverStart={() => setActiveId(service.id)}
                            className={`relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 ease-in-out border border-black dark:border-white/10 dark:border-white/10 ${isActive ? 'flex-[4]' : 'flex-[1]'}`}
                        >
                            <Image
                                src={service.image}
                                alt={service.title}
                                fill
                                className={`object-cover transition-transform duration-700 ${isActive ? 'scale-110' : 'scale-100 grayscale opacity-50'}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                            <div className="absolute inset-0 p-8 flex flex-col justify-end">
                                <div className="space-y-4">
                                    <h3
                                        className={`font-bold text-white transition-all duration-500 ease-in-out origin-left ${isActive ? 'text-3xl translate-y-0' : 'text-xl rotate-[-90deg] translate-y-8 opacity-80'
                                            }`}
                                    >
                                        {service.title}
                                    </h3>

                                    <div
                                        className={`overflow-hidden transition-all duration-700 ease-in-out ${isActive ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0'
                                            }`}
                                    >
                                        <div className="min-w-[300px] pt-4">
                                            <p className="text-xl text-orange-500 font-medium mb-2 transform transition-all duration-500 delay-100 translate-x-0">{service.subtitle}</p>
                                            <p className="text-neutral-300 mb-6 max-w-md transform transition-all duration-500 delay-200 translate-x-0">{service.description}</p>
                                            <Link
                                                href={`/services/${service.id}`}
                                                className="inline-flex items-center gap-2 bg-neutral-900 border border-white/20 text-white px-6 py-3 rounded-full font-bold hover:bg-[#d35400] hover:border-[#d35400] transition-all transform transition-all duration-500 delay-300 translate-y-0"
                                            >
                                                {t('explore')} <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col gap-4">
                {/* Active Card (Expanded) */}
                <AnimatePresence mode="popLayout">
                    {SERVICES.filter(s => s.id === activeId).map((service) => (
                        <motion.div
                            key={service.id}
                            layoutId={service.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full aspect-[4/5] relative rounded-[2rem] overflow-hidden shadow-2xl border border-black dark:border-white/10 dark:border-white/10"
                        >
                            <Image
                                src={service.image}
                                alt={service.title}
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-8">
                                <h3 className="text-3xl font-bold mb-2">{service.title}</h3>
                                <p className="text-orange-500 font-medium mb-2 text-lg">{service.subtitle}</p>
                                <p className="text-neutral-300 mb-6 text-sm">{service.description}</p>
                                <Link
                                    href={`/services/${service.id}`}
                                    className="w-full block text-center bg-white text-black px-6 py-4 rounded-xl font-bold"
                                >
                                    {t('explore')}
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Thumbnails Row */}
                <div className="grid grid-cols-4 gap-2">
                    {SERVICES.filter(s => s.id !== activeId).map((service) => (
                        <motion.button
                            key={service.id}
                            layoutId={service.id}
                            onClick={() => setActiveId(service.id)}
                            className="aspect-square relative rounded-xl overflow-hidden border border-black dark:border-white/10 dark:border-white/10 grayscale opacity-70"
                            whileTap={{ scale: 0.95 }}
                        >
                            <Image
                                src={service.image}
                                alt={service.title}
                                fill
                                className="object-cover"
                            />
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
}
