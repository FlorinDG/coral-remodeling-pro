"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Link, usePathname } from '@/i18n/routing';
import { TenantProvider } from '@/context/TenantContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
    LayoutDashboard, FileText, Wallet, Users,
    Menu, X, LogOut, Settings, FileSignature, ChevronDown, FolderOpen, Loader2
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
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const [brandColor, setBrandColor] = useState('#d35400');
    const [companyName, setCompanyName] = useState('');
    const [isTenantChecked, setIsTenantChecked] = useState(false);

    useEffect(() => {
        // Prevent IDB ghosting on tenant switch
        if (!tenant?.id) {
            setIsTenantChecked(true);
            return;
        }

        const lastTenantId = localStorage.getItem('mobile-last-tenant-id');
        if (lastTenantId && lastTenantId !== tenant.id) {
            console.warn('[MobileShell] Tenant switched. Clearing IDB storage...');
            del('coral-database-storage-v4').then(() => {
                localStorage.setItem('mobile-last-tenant-id', tenant.id);
                // Hard reload to wipe memory state from previous tenant
                window.location.reload();
            }).catch(() => {
                localStorage.setItem('mobile-last-tenant-id', tenant.id);
                setIsTenantChecked(true);
            });
        } else {
            localStorage.setItem('mobile-last-tenant-id', tenant.id);
            setIsTenantChecked(true);
        }
    }, [tenant?.id]);


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

    if (!isTenantChecked) {
        return (
            <div className="min-h-screen w-full bg-neutral-50 dark:bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

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
                        <Link
                            href="/m/settings?tab=company-info"
                            className="p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                                {firstName[0]}
                            </div>
                        </Link>
                    </div>
                </div>
            </header>

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
