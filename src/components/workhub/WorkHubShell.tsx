"use client";

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useSession } from 'next-auth/react';
import { Link, usePathname } from '@/i18n/routing';
import { useTranslation } from 'react-i18next';
import { TenantProvider } from '@/context/TenantContext';
import { ROLES } from '@/lib/roles';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
    Clock, CalendarDays, CalendarOff, FolderOpen,
    CheckSquare, FileText, User, LogOut, Menu,
    BookOpen
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { del } from 'idb-keyval';

// ── Navigation Items ──────────────────────────────────────────────────
interface NavItem {
    id: string;
    /** time-tracker i18n key (the crew app's own instance: en · nl · fr · ro · ru) */
    labelKey: string;
    href: string;
    icon: React.ReactNode;
}

const PRIMARY_ITEMS: NavItem[] = [
    { id: 'schedule', labelKey: 'nav.schedule',   href: '/workhub',           icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'leave',    labelKey: 'nav.timeOff',    href: '/workhub/leave',     icon: <CalendarOff className="w-5 h-5" /> },
    { id: 'tasks',    labelKey: 'nav.tasks',      href: '/workhub/tasks',     icon: <CheckSquare className="w-5 h-5" /> },
];

const SECONDARY_ITEMS: NavItem[] = [
    { id: 'timesheets', labelKey: 'nav.timesheets', href: '/workhub/timesheets', icon: <Clock className="w-5 h-5" /> },
    { id: 'files',     labelKey: 'nav.documents',   href: '/workhub/files',      icon: <FileText className="w-5 h-5" /> },
    { id: 'projects',  labelKey: 'nav.projects',    href: '/workhub/projects',   icon: <FolderOpen className="w-5 h-5" /> },
    { id: 'wiki',      labelKey: 'nav.wiki',        href: '/workhub/wiki',       icon: <BookOpen className="w-5 h-5" /> },
];

// Bottom Nav logic moved inside component to handle state/filtering
export default function WorkHubShell({
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
    const { t } = useTranslation();
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [brandColor, setBrandColor] = useState('#d35400');

    useEffect(() => {
        if (tenant?.brandColor) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBrandColor(tenant.brandColor);
            document.documentElement.style.setProperty('--brand-color', tenant.brandColor);
        }
    }, [tenant]);

    const isSessionLoading = status === 'loading';
    const userName = session?.user?.name || '';
    const firstName = userName ? userName.split(' ')[0] : '';
    const userRole = session?.user?.role as any;
    const isWorkforce = userRole === ROLES.TENANT_ENTERPRISE_WORKFORCE || userRole === 'TENANT_PRO_WORKFORCE' || userRole === 'crew';

    const filteredPrimaryItems = PRIMARY_ITEMS;

    // Workforce users retain access to Documents (files) in the drawer (WHS-1 §4)
    const filteredSecondaryItems = SECONDARY_ITEMS.filter(item => {
        if (isWorkforce && ['projects', 'team', 'wiki'].includes(item.id)) return false;
        return true;
    });

    const mobileTabs = [
        ...filteredPrimaryItems,
        { id: 'menu', labelKey: 'nav.menu', href: '#', icon: <Menu className="w-5 h-5" /> }
    ];

    const isActive = (href: string) => {
        if (href === '/workhub') {
            return pathname === '/workhub';
        }
        if (href === '/workhub/files') {
            return pathname.startsWith('/workhub/files') || pathname.startsWith('/workhub/projects');
        }
        return pathname.startsWith(href);
    };

    return (
        <div
            // WH-2: overflow-x-clip — nothing inside the crew app may widen the page past the phone.
            // One over-wide row made iOS zoom the whole app out to ~75% (all text with it).
            className="min-h-screen w-full overflow-x-clip bg-neutral-50 dark:bg-black text-neutral-900 dark:text-white flex flex-col font-content"
            style={{ '--brand-color': brandColor } as React.CSSProperties}
        >
            {/* ── Top Bar ── */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10">
                <div className="flex items-center justify-between h-14 px-4 w-full">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-black tracking-tight" style={{ color: brandColor }}>WorkHub</h1>
                        {isSessionLoading ? (
                            <div className="w-16 h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                        ) : userName ? (
                            <>
                                <span className="text-sm font-bold text-neutral-350 dark:text-neutral-700">•</span>
                                <span className="text-sm font-bold text-neutral-550 dark:text-neutral-450 truncate max-w-[140px]" title={userName}>{userName}</span>
                            </>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />

                        {/* Desktop: User avatar */}
                        {firstName && (
                            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-white/10 ml-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold">
                                    {firstName[0]}
                                </div>
                                <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">{firstName}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop: Horizontal tab navigation */}
                <nav className="hidden md:block border-t border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-1 px-4 w-full flex-wrap justify-center">
                        {[...filteredPrimaryItems, ...filteredSecondaryItems].map(item => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold tracking-wide whitespace-nowrap transition-all border-b-2 ${
                                    isActive(item.href)
                                        ? 'border-[var(--brand-color)] text-[var(--brand-color)]'
                                        : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                                }`}
                            >
                                {item.icon}
                                {t(item.labelKey)}
                            </Link>
                        ))}
                    </div>
                </nav>
            </header>

            {/* ── Mobile slide-down menu ── */}
            {menuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
                    <div className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-white/10 shadow-2xl mt-14 mx-0 animate-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 space-y-1">
                            {/* WH-2: the drawer carries only what the bottom bar does not — no item twice */}
                            {filteredSecondaryItems.map(item => (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setMenuOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                                        isActive(item.href)
                                            ? 'bg-orange-50 dark:bg-orange-500/10 text-[var(--brand-color)]'
                                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    {item.icon}
                                    {t(item.labelKey)}
                                </Link>
                            ))}

                            <div className="border-t border-neutral-200 dark:border-white/10 mt-3 pt-3">
                                {userName && (
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold">
                                            {firstName ? firstName[0] : ''}
                                        </div>
                                        <p className="text-base font-bold">{userName}</p>
                                    </div>
                                )}
                                <Link
                                    href="/workhub/profile"
                                    onClick={() => setMenuOpen(false)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <User className="w-5 h-5 text-neutral-500" /> {t('nav.profile')}
                                </Link>
                                <button
                                    onClick={async () => {
                                        try { await del('coral-database-storage-v4'); localStorage.removeItem('coral-schema-version'); } catch {}
                                        signOut({ callbackUrl: "/login" });
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" /> {t('nav.signOut')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            <main className="flex-1 pb-44 md:pb-0 overflow-y-auto">
                <TenantProvider activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={tenant}>
                    {children}
                </TenantProvider>
            </main>

            {/* ── Mobile Bottom Nav (WH-UI-1 §9.1, §9.2) ── */}
            <nav 
                className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-[var(--persian-green)]/20 bg-[var(--persian-green)] backdrop-blur-xl shadow-lg"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <div className="flex items-center justify-around h-[4.5rem] px-1">
                    {mobileTabs.map(item => {
                        const active = item.id === 'menu' ? menuOpen : isActive(item.href);
                        const content = (
                            <>
                                <div className={`transition-transform [&>svg]:w-6 [&>svg]:h-6 ${active ? 'scale-105' : ''}`}>
                                    {item.icon}
                                </div>
                                <span className="text-[0.8125rem] leading-none font-semibold tracking-wide">
                                    {t(item.labelKey)}
                                </span>
                            </>
                        );
                        const buttonClasses = `flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[48px] px-3.5 py-1.5 rounded-xl transition-all relative ${
                            active
                                ? 'text-white bg-black/20 shadow-inner'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`;

                        if (item.id === 'menu') {
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setMenuOpen(!menuOpen)}
                                    className={buttonClasses}
                                >
                                    {content}
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={buttonClasses}
                            >
                                {content}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <Toaster position="top-center" richColors closeButton />
        </div>
    );
}
