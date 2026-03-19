"use client";

import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BookingModal from '@/components/BookingModal';
import { useState } from 'react';

interface ServiceDetailClientProps {
    service: {
        title: string;
        subtitle: string;
        fullDescription: string;
        features: string[];
        image: string;
        slug: string;
    };
    translations: {
        back: string;
        specializeIn: string;
        keyFeatures: string;
        ready: string;
        schedule: string;
        bookConsultation: string;
        notFound: string;
    };
}

export default function ServiceDetailClient({ service, translations }: ServiceDetailClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <main className="min-h-screen bg-white text-neutral-900 dark:bg-black dark:text-white pt-10">
            <Navbar
                onBookClick={() => setIsModalOpen(true)}
                backLink={{ href: "/#services", label: translations.back }}
            />

            <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

            <div className="relative h-[60vh] w-full">
                <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover opacity-60 dark:opacity-40"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-white dark:to-black" />

                <div className="absolute bottom-0 left-0 p-8 md:p-16 w-full max-w-4xl">
                    <p className="text-[#d35400] font-bold tracking-widest uppercase mb-4">{service.subtitle}</p>
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 text-neutral-900 dark:text-white">{service.title}</h1>
                </div>
            </div>

            <div className="container mx-auto px-8 md:px-16 py-16 grid md:grid-cols-[2fr_1fr] gap-16">
                <div className="space-y-12">
                    <div className="space-y-6">
                        <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                            {service.slug === 'kitchen-design' ? translations.specializeIn : translations.keyFeatures}
                        </h3>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {service.features.map((feature, index) => (
                                <li key={index} className="flex items-start gap-3 text-neutral-600 dark:text-neutral-300">
                                    <span className="text-[#d35400] mt-1">•</span>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="prose dark:prose-invert prose-lg max-w-none">
                        <p className="text-xl leading-relaxed text-neutral-600 dark:text-neutral-300 whitespace-pre-line">
                            {service.fullDescription}
                        </p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="glass-morphism p-8 rounded-3xl border border-neutral-200 dark:border-white/10 sticky top-8">
                        <h3 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">{translations.ready}</h3>
                        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
                            {translations.schedule}
                        </p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="w-full bg-[#d35400] text-white font-bold py-4 rounded-xl hover:bg-[#a04000] transition-colors shadow-lg shadow-[#d35400]/20"
                        >
                            {translations.bookConsultation}
                        </button>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}
