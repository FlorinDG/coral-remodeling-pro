"use client";

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import Logo from './Logo';
import Topbar from './Topbar';
import { Phone, MessageCircle, Mail, ArrowLeft, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
    onBookClick: () => void;
    backLink?: { href: string; label: string };
}

export default function Navbar({ onBookClick, backLink }: NavbarProps) {
    const t = useTranslations('Navbar');
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isPortalOrAdmin = pathname.includes('/admin') || pathname.includes('/portal');
    const displayTitle = isPortalOrAdmin ? t('topbarTitlePortal') : t('topbarTitle');

    return (
        <nav className="fixed top-0 left-0 right-0 z-50">
            <Topbar />

            <div className="glass-morphism backdrop-blur-md h-20 flex items-center justify-between px-8 md:px-16">
                {/* Logo Section - Left Half Start */}
                <div className="flex items-center min-w-[120px]">
                    {backLink ? (
                        <Link href={backLink.href} className="flex items-center gap-2 text-neutral-900/80 dark:text-white/80 hover:text-[#d35400] transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-bold text-sm tracking-widest">{t('back')}</span>
                        </Link>
                    ) : (
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 block">
                                <Logo className="w-full h-full group-hover:scale-105 transition-transform" />
                            </div>
                            <span className="font-black text-xs sm:text-sm md:text-base tracking-widest uppercase text-neutral-900 dark:text-white group-hover:text-[#d35400] transition-colors">
                                {displayTitle}
                            </span>
                        </Link>
                    )}
                </div>

                {/* Navigation Links - Middle of Left Half */}
                <div className="hidden lg:flex flex-1 justify-center max-w-[40%] text-[11px] font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-white/90">
                    <div className="flex gap-12">
                        <Link href="/" className="hover:text-[#d35400] transition-colors">{t('home')}</Link>
                        <Link href="/#services" className="hover:text-[#d35400] transition-colors">{t('services')}</Link>
                        <Link href="/#projects" className="hover:text-[#d35400] transition-colors">{t('projects')}</Link>
                    </div>
                </div>

                {/* Contact Shortcuts - Right Half */}
                <div className="hidden md:flex gap-8 items-center flex-1 justify-center border-l border-neutral-200 dark:border-white/5 ml-8 h-10">
                    <a href={`tel:${t('fastInterventions.number')}`} className="flex flex-col items-center gap-1 group hover:text-[#d35400] transition-colors">
                        <Phone className="w-4 h-4 text-neutral-400 group-hover:text-[#d35400] dark:text-neutral-300" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter leading-none opacity-60 group-hover:opacity-100 dark:text-white/80">{t('contact.call')}</span>
                    </a>
                    <a href="https://wa.me/32472741025" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 group hover:text-[#d35400] transition-colors">
                        <MessageCircle className="w-4 h-4 text-neutral-400 group-hover:text-[#d35400] dark:text-neutral-300" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter leading-none opacity-60 group-hover:opacity-100 dark:text-white/80">{t('contact.whatsapp')}</span>
                    </a>
                    <a href="mailto:info@coral-group.be" className="flex flex-col items-center gap-1 group hover:text-[#d35400] transition-colors">
                        <Mail className="w-4 h-4 text-neutral-400 group-hover:text-[#d35400] dark:text-neutral-300" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter leading-none opacity-60 group-hover:opacity-100 dark:text-white/80">{t('contact.email')}</span>
                    </a>
                </div>

                {/* Actions - Right End */}
                <div className="flex items-center gap-6 min-w-[200px] justify-end">
                    <div className="hidden lg:flex items-center gap-4">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                    <button
                        onClick={onBookClick}
                        className="bg-[#d35400] text-white px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-neutral-900 transition-all shadow-xl shadow-[#d35400]/20 active:scale-95"
                    >
                        {t('book')}
                    </button>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-2 -mr-2 text-neutral-900 dark:text-white hover:text-[#d35400] dark:hover:text-[#d35400] transition-colors"
                        aria-label="Toggle Menu"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden absolute top-full left-0 right-0 glass-morphism backdrop-blur-2xl border-b border-neutral-200 dark:border-white/10 bg-white/95 dark:bg-black/95 px-8 py-8 flex flex-col gap-8 shadow-2xl max-h-[calc(100vh-120px)] overflow-y-auto">
                    <div className="flex flex-col gap-6 text-sm font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-white/90">
                        <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#d35400] transition-colors">{t('home')}</Link>
                        <Link href="/#services" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#d35400] transition-colors">{t('services')}</Link>
                        <Link href="/#projects" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#d35400] transition-colors">{t('projects')}</Link>
                    </div>

                    <div className="h-px bg-neutral-200 dark:bg-white/10 w-full" />

                    <div className="flex flex-col gap-5">
                        <a href={`tel:${t('fastInterventions.number')}`} className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-[#d35400]">
                            <Phone className="w-5 h-5 text-neutral-400" />
                            {t('contact.call')}
                        </a>
                        <a href="https://wa.me/32472741025" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-[#d35400]">
                            <MessageCircle className="w-5 h-5 text-neutral-400" />
                            {t('contact.whatsapp')}
                        </a>
                        <a href="mailto:info@coral-group.be" className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-[#d35400]">
                            <Mail className="w-5 h-5 text-neutral-400" />
                            {t('contact.email')}
                        </a>
                    </div>

                    <div className="h-px bg-neutral-200 dark:bg-white/10 w-full" />

                    <div className="flex items-center justify-between pt-2">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>
            )}
        </nav>
    );
}
