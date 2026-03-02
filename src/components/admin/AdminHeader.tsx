import Logo from '@/components/Logo';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function AdminHeader() {
    const t = useTranslations('Admin.header');
    return (
        <header className="fixed top-0 left-0 right-0 z-50 glass-morphism border-b border-white/5">
            <div className="container mx-auto px-8 h-20 flex items-center justify-between">
                <Link href="/admin" className="flex items-center gap-4 group">
                    <div className="w-10 h-10 transition-transform group-hover:scale-105">
                        <Logo className="w-full h-full" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">CORAL ADMIN</h1>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">{t('title')}</p>
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <Link href="/" target="_blank" className="text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-[#d35400] dark:hover:text-white transition-colors">
                        {t('viewLive')}
                    </Link>
                    <div className="w-8 h-8 rounded-full bg-[#d35400] flex items-center justify-center text-xs font-bold text-white">
                        A
                    </div>
                </div>
            </div>
        </header>
    );
}
