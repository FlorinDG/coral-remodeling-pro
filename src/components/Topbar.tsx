"use client";

import { useTranslations } from 'next-intl';

export default function Topbar() {
    const t = useTranslations('Navbar');

    return (
        <div className="bg-black border-b border-white/5 h-10 flex items-center justify-center px-8 w-full">
            <div className="flex items-center gap-4 text-xs font-bold tracking-[0.2em] uppercase">
                <span className="text-neutral-400 italic">{t('fastInterventions.label')}:</span>
                <a href={`tel:${t('fastInterventions.number')}`} className="text-white hover:text-[#d35400] transition-colors">
                    {t('fastInterventions.number')}
                </a>
            </div>
        </div>
    );
}
