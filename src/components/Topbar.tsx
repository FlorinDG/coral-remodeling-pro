"use client";

import { useTranslations } from 'next-intl';

export default function Topbar() {
    const t = useTranslations('Navbar');

    return (
        <div className="bg-black border-b border-white/5 h-10 flex items-center px-8 w-full max-w-[1920px] mx-auto overflow-hidden">
            <div className="flex-1 hidden md:flex">
                <span className="text-xs font-bold tracking-[0.4em] uppercase text-white/30 whitespace-nowrap">
                    Luxury. Redefined.
                </span>
            </div>

            {/* Mobile View */}
            <a href={`tel:${t('fastInterventions.number')}`} className="flex md:hidden flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase w-full h-full">
                <span className="text-neutral-400 italic font-medium">{t('fastInterventions.label')}:</span>
                <span className="text-white">{t('fastInterventions.number')}</span>
            </a>

            {/* Desktop View */}
            <div className="hidden md:flex items-center gap-4 text-sm font-bold tracking-[0.2em] uppercase mx-auto md:mx-0">
                <span className="text-neutral-400 italic font-medium">{t('fastInterventions.label')}:</span>
                <a href={`tel:${t('fastInterventions.number')}`} className="text-white hover:text-[#d35400] transition-colors">
                    {t('fastInterventions.number')}
                </a>
            </div>

            <div className="flex-1 hidden md:block" />
        </div>
    );
}
