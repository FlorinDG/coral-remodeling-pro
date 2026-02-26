import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import Logo from './Logo';

interface NavbarProps {
    onBookClick: () => void;
    backLink?: { href: string; label: string };
}

export default function Navbar({ onBookClick, backLink }: NavbarProps) {
    const t = useTranslations('Navbar');

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass-morphism backdrop-blur-md h-20 flex items-center justify-between px-8 md:px-16">
            <div className="flex items-center gap-4">
                {backLink ? (
                    <Link href={backLink.href as any} className="flex items-center gap-2 text-neutral-900/80 dark:text-white/80 hover:text-[#d35400] transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold text-sm tracking-widest">{t('back')}</span>
                    </Link>
                ) : (
                    <div className="w-10 h-10">
                        <Logo className="w-full h-full" />
                    </div>
                )}
            </div>
            {!backLink && (
                <div className="hidden md:flex gap-8 text-sm font-medium text-neutral-900 dark:text-white">
                    <Link href="#services" className="hover:text-[#d35400] transition-colors">{t('services')}</Link>
                    <Link href="#projects" className="hover:text-[#d35400] transition-colors">{t('projects')}</Link>
                    <Link href="/" className="hover:text-[#d35400] transition-colors">{t('home')}</Link>
                </div>
            )}
            <div className="flex items-center gap-6">
                <LanguageSwitcher />
                <ThemeToggle />
                <button
                    onClick={onBookClick}
                    className="bg-[#d35400] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[#a04000] transition-colors shadow-lg shadow-[#d35400]/20"
                >
                    {t('book')}
                </button>
            </div>
        </nav>
    );
}
