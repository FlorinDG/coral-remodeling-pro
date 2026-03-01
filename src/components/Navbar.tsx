import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import Logo from './Logo';
import Topbar from './Topbar';
import { Phone, MessageCircle, Mail, ArrowLeft } from 'lucide-react';

interface NavbarProps {
    onBookClick: () => void;
    backLink?: { href: string; label: string };
}

export default function Navbar({ onBookClick, backLink }: NavbarProps) {
    const t = useTranslations('Navbar');

    return (
        <nav className="fixed top-0 left-0 right-0 z-50">
            <Topbar />

            <div className="glass-morphism backdrop-blur-md h-20 flex items-center justify-between px-8 md:px-16">
                {/* Logo Section - Left Half Start */}
                <div className="flex items-center min-w-[120px]">
                    {backLink ? (
                        <Link href={backLink.href as any} className="flex items-center gap-2 text-neutral-900/80 dark:text-white/80 hover:text-[#d35400] transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-bold text-sm tracking-widest">{t('back')}</span>
                        </Link>
                    ) : (
                        <Link href="/" className="w-10 h-10 block group">
                            <Logo className="w-full h-full group-hover:scale-105 transition-transform" />
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
                    <a href="mailto:contact@coral-remodeling.pro" className="flex flex-col items-center gap-1 group hover:text-[#d35400] transition-colors">
                        <Mail className="w-4 h-4 text-neutral-400 group-hover:text-[#d35400] dark:text-neutral-300" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter leading-none opacity-60 group-hover:opacity-100 dark:text-white/80">{t('contact.email')}</span>
                    </a>
                </div>

                {/* Actions - Right End */}
                <div className="flex items-center gap-6 min-w-[200px] justify-end">
                    <div className="hidden sm:flex items-center gap-4">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                    <button
                        onClick={onBookClick}
                        className="bg-[#d35400] text-white px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-neutral-900 transition-all shadow-xl shadow-[#d35400]/20 active:scale-95"
                    >
                        {t('book')}
                    </button>
                </div>
            </div>
        </nav>
    );
}
