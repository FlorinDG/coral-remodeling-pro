"use client";

import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Logo from './Logo';
import { Phone, MessageCircle, Mail, MapPin, Building, ShieldCheck } from 'lucide-react';

export default function Footer() {
    const t = useTranslations('Footer');
    const nt = useTranslations('Navbar');

    return (
        <footer className="bg-neutral-950 text-white pt-24 pb-12 border-t border-white/5 relative overflow-hidden">
            {/* Background Decorative Mesh */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#d35400]/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#d35400]/5 rounded-full blur-[100px] -ml-48 -mb-48 pointer-events-none" />

            <div className="container mx-auto px-8 md:px-16 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10">
                                <Logo className="w-full h-full text-[#d35400]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold tracking-tighter uppercase italic leading-none">
                                    Coral <span className="text-[#d35400]">Enterprises</span>
                                </span>
                                <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d35400] mt-1">
                                    Luxury. Redefined.
                                </span>
                            </div>
                        </div>
                        <p className="text-neutral-300 text-sm leading-relaxed max-w-xs">
                            {t('description')}
                        </p>
                    </div>

                    {/* Quick Links Column */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#d35400]">
                            {t('quickLinks')}
                        </h4>
                        <ul className="space-y-4 text-sm font-medium">
                            <li><Link href="/" className="text-neutral-300 hover:text-white transition-colors">{nt('home')}</Link></li>
                            <li><Link href="#services" className="text-neutral-300 hover:text-white transition-colors">{nt('services')}</Link></li>
                            <li><Link href="#projects" className="text-neutral-300 hover:text-white transition-colors">{nt('projects')}</Link></li>
                        </ul>
                    </div>

                    {/* Contact Column */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#d35400]">
                            {t('contact')}
                        </h4>
                        <ul className="space-y-4 text-sm">
                            <li>
                                <a href="tel:+32472741025" className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors group">
                                    <Phone className="w-4 h-4 text-[#d35400]" />
                                    <span>+32 472 74 10 25</span>
                                </a>
                            </li>
                            <li>
                                <a href="https://wa.me/32472741025" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors">
                                    <MessageCircle className="w-4 h-4 text-[#d35400]" />
                                    <span>WhatsApp</span>
                                </a>
                            </li>
                            <li>
                                <a href="mailto:contact@coral-remodeling.pro" className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors">
                                    <Mail className="w-4 h-4 text-[#d35400]" />
                                    <span>Email Us</span>
                                </a>
                            </li>
                            <li className="pt-2">
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#d35400]">
                                        {t('fastInterventions')}
                                    </p>
                                    <a href="tel:+32472741025" className="text-lg font-bold tracking-tighter hover:text-[#d35400] transition-colors">
                                        +32 472 74 10 25
                                    </a>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Office Column */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#d35400]">
                            {t('office')}
                        </h4>
                        <ul className="space-y-4 text-sm text-neutral-300">
                            <li className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 mt-0.5 text-[#d35400]" />
                                <span>{t('address')}</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Building className="w-4 h-4 text-[#d35400]" />
                                <span>VAT: {t('vat')}</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <ShieldCheck className="w-4 h-4 text-[#d35400]" />
                                <span>{t('legal')} Information</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.3em]">
                        {t('copy')}
                    </p>
                    <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
