"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Link, usePathname } from '@/i18n/routing';
import { TenantProvider } from '@/context/TenantContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
    LayoutDashboard, FileText, Wallet, Users,
    Menu, X, LogOut, Settings, FileSignature, ChevronDown
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { del } from 'idb-keyval';
import { useTranslations } from 'next-intl';


interface NavTab {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
}

export default function MobileShell({
    children,
    activeModules,
    planType,
    lockedDbIds,
    tenant,
}: {
    children: React.ReactNode;
    activeModules: string[];
    planType: string;
    lockedDbIds: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tenant?: any;
}) {
    const t = useTranslations('Mobile');
    const { data: session } = useSession();
    const pathname = usePathname();

    const TABS: NavTab[] = [
        { id: 'home',     label: t('nav_dashboard'), href: '/m',           icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'invoices', label: t('nav_invoices'),  href: '/m/invoices',  icon: <FileText className="w-5 h-5" /> },
        { id: 'expenses', label: t('nav_expenses'),  href: '/m/expenses',  icon: <Wallet className="w-5 h-5" /> },
        { id: 'clients',  label: t('nav_clients'),   href: '/m/clients',   icon: <Users className="w-5 h-5" /> },
        { id: 'quotes',   label: t('nav_quotes'),    href: '/m/quotes',    icon: <FileSignature className="w-5 h-5" /> },
    ];
    const [menuOpen, setMenuOpen] = useState(false);
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const [brandColor, setBrandColor] = useState('#d35400');
    const [companyName, setCompanyName] = useState('');


    useEffect(() => {
        // Clear any bypass when entering/staying inside mobile shell /m
        try {
            localStorage.removeItem('bypass-mobile-redirect');
            document.cookie = "desktop-view=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        } catch {}

        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');
            if (anchor) {
                const href = anchor.getAttribute('href');
                if (href && (href.includes('/admin') || href.startsWith('admin'))) {
                    try {
                        localStorage.setItem('bypass-mobile-redirect', 'true');
                        document.cookie = "desktop-view=true; path=/; max-age=31536000; SameSite=Lax";
                    } catch {}
                }
            }
        };

        document.addEventListener('click', handleGlobalClick);
        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };

        if (tenant) {
            if (tenant.brandColor) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setBrandColor(tenant.brandColor);
                document.documentElement.style.setProperty('--brand-color', tenant.brandColor);
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (tenant.companyName) setCompanyName(tenant.companyName);
        }

        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };
    }, [tenant]);

    const userName = session?.user?.name || 'User';
    const firstName = userName.split(' ')[0];

    const isActive = (href: string) => {
        if (href === '/m') return pathname === '/m';
        return pathname.startsWith(href);
    };

    return (
        <div
            className="min-h-screen w-full bg-neutral-50 dark:bg-black text-neutral-950 dark:text-white flex flex-col overflow-x-hidden"
            style={{ '--brand-color': brandColor } as React.CSSProperties}
        >
            {/* ── Top Bar ── */}
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-300 dark:border-white/10">
                <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto w-full">
                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="text-sm font-black tracking-tight truncate max-w-[180px]" style={{ color: brandColor }}>
                            {companyName || 'CoralOS'}
                        </h1>
                        <span className="text-[9px] font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest shrink-0">
                            {planType}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <ThemeToggle />
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-neutral-950 dark:text-white"
                        >
                            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Slide-down menu ── */}
            {menuOpen && (
                <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)}>
                    <div
                        className="bg-white dark:bg-neutral-950 border-b border-neutral-300 dark:border-white/10 shadow-2xl mt-14 animate-in slide-in-from-top-2 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 space-y-1 max-w-lg mx-auto">
                            {/* User card */}
                            <div className="flex items-center gap-3 px-4 py-3 mb-2">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                    {firstName[0]}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold truncate text-neutral-950 dark:text-white">{userName}</p>
                                    <p className="text-[10px] text-neutral-600 dark:text-neutral-300 uppercase tracking-wider font-bold">{planType} {t('shell_plan')}</p>
                                </div>
                            </div>

                            {/* Settings (collapsible) */}
                            <button
                                onClick={() => setSettingsExpanded(!settingsExpanded)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-white/5"
                            >
                                <div className="flex items-center gap-3">
                                    <Settings className="w-5 h-5 text-neutral-900 dark:text-neutral-200" />
                                    <span>{t('shell_settings')}</span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-neutral-900 dark:text-neutral-200 transition-transform ${settingsExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {settingsExpanded && (
                                <div className="pl-6 space-y-1 mt-1 border-l-2 border-neutral-200 dark:border-white/10 ml-6 animate-in slide-in-from-left-2 duration-150">
                                    {[
                                        { id: "company-info", label: t('settings_tab_identity') },
                                        { id: "billing", label: t('settings_tab_billing') },
                                        { id: "ui", label: t('settings_tab_branding') },
                                        { id: "opt-peppol", label: t('settings_tab_peppol') },
                                        { id: "opt-templates", label: t('settings_tab_stationery') },
                                        { id: "accountant", label: t('settings_tab_accountant') },
                                    ].map(tab => (
                                        <Link
                                            key={tab.id}
                                            href={`/m/settings?tab=${tab.id}`}
                                            onClick={() => setMenuOpen(false)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-extrabold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            {tab.label}
                                        </Link>
                                    ))}
                                </div>
                            )}


                            {/* Sign out */}
                            <div className="border-t border-neutral-300 dark:border-white/10 mt-2 pt-2">
                                <button
                                    onClick={async () => {
                                        try { await del('coral-database-storage-v4'); localStorage.removeItem('coral-schema-version'); } catch {}
                                        signOut({ callbackUrl: "/" });
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" /> {t('shell_sign_out')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            <main className="flex-1 pb-20 overflow-y-auto">
                <TenantProvider activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={tenant}>
                    {children}
                </TenantProvider>
            </main>

            {/* ── Bottom Tab Bar ── */}
            <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-neutral-300 dark:border-white/10 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl shadow-lg">
                <div className="flex items-center justify-around h-16 max-w-lg mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {TABS.map(tab => (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all relative ${
                                isActive(tab.href)
                                    ? 'text-[var(--brand-color)]'
                                    : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
                            }`}
                        >
                            <div className={`transition-transform ${isActive(tab.href) ? 'scale-110' : ''}`}>
                                {tab.icon}
                            </div>
                            <span className={`text-[9.5px] font-extrabold tracking-wider ${
                                isActive(tab.href) ? 'text-[var(--brand-color)]' : ''
                            }`}>
                                {tab.label}
                            </span>
                            {isActive(tab.href) && (
                                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ backgroundColor: brandColor }} />
                            )}
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
