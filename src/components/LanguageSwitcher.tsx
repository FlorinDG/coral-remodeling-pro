"use client";

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../i18n/routing';
import { useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);

    const languages = [
        { code: 'nl', label: 'NL' },
        { code: 'en', label: 'EN' },
        { code: 'fr', label: 'FR' },
        { code: 'ro', label: 'RO' },
    ];

    const onSelectChange = (nextLocale: string) => {
        setIsOpen(false);
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-[#d35400] dark:text-white/80 hover:text-[#d35400] dark:hover:text-white transition-colors"
                disabled={isPending}
            >
                <Globe className="w-5 h-5" />
                <span className="uppercase font-bold text-sm tracking-wider">{locale}</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 top-full mt-2 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden min-w-[100px] z-50 py-2"
                    >
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => onSelectChange(lang.code)}
                                className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors ${locale === lang.code ? 'text-[#d35400]' : 'text-white/80'
                                    }`}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
