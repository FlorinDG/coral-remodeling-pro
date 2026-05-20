"use client";

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useSession } from 'next-auth/react';
import { Link, usePathname } from '@/i18n/routing';
import { TenantProvider } from '@/context/TenantContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
    Clock, CalendarDays, CalendarOff, Users, FolderOpen,
    CheckSquare, FileText, User, LogOut, Menu, X, ChevronLeft,
    LayoutDashboard
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { del } from 'idb-keyval';

// ── Navigation Items ──────────────────────────────────────────────────
interface NavItem {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    mobileLabel: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'home',     label: 'Work Hub',          href: '/workhub',           icon: <LayoutDashboard className="w-5 h-5" />, mobileLabel: 'Home' },
    { id: 'schedule', label: 'Schedule',           href: '/workhub/schedule',  icon: <CalendarDays className="w-5 h-5" />,    mobileLabel: 'Schedule' },
    { id: 'leave',    label: 'Leave',              href: '/workhub/leave',     icon: <CalendarOff className="w-5 h-5" />,     mobileLabel: 'Leave' },
    { id: 'tasks',    label: 'My Tasks',           href: '/workhub/tasks',     icon: <CheckSquare className="w-5 h-5" />,     mobileLabel: 'Tasks' },
    { id: 'files',    label: 'Documents',          href: '/workhub/files',     icon: <FileText className="w-5 h-5" />,        mobileLabel: 'Files' },
];

const SECONDARY_ITEMS: NavItem[] = [
    { id: 'team',      label: 'Team Directory',    href: '/workhub/team',      icon: <Users className="w-5 h-5" />,           mobileLabel: 'Team' },
    { id: 'timesheets', label: 'Timesheets',       href: '/workhub/timesheets', icon: <Clock className="w-5 h-5" />,          mobileLabel: 'Timesheets' },
    { id: 'projects',  label: 'Projects',          href: '/workhub/projects',  icon: <FolderOpen className="w-5 h-5" />,      mobileLabel: 'Projects' },
];

// ── Bottom Nav (mobile — 5 tabs max) ──────────────────────────────────
const BOTTOM_TABS = NAV_ITEMS.slice(0, 5);

export default function WorkHubShell({
    children,
    activeModules,
    planType,
    lockedDbIds,
}: {
    children: React.ReactNode;
    activeModules: string[];
    planType: string;
    lockedDbIds: Record<string, string>;
}) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [brandColor, setBrandColor] = useState('#d35400');

    useEffect(() => {
        fetch('/api/tenant/profile').then(r => r.json()).then(d => {
            if (d?.brandColor) {
                setBrandColor(d.brandColor);
                document.documentElement.style.setProperty('--brand-color', d.brandColor);
            }
        }).catch(() => {});
    }, []);

    const userName = session?.user?.name || 'User';
    const firstName = userName.split(' ')[0];

    const isActive = (href: string) => {
        if (href === '/workhub') return pathname === '/workhub';
        return pathname.startsWith(href);
    };

    return (
        <div
            className="min-h-screen w-full bg-neutral-50 dark:bg-black text-neutral-900 dark:text-white flex flex-col"
            style={{ '--brand-color': brandColor } as React.CSSProperties}
        >
            {/* ── Top Bar ── */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10">
                <div className="flex items-center justify-between h-14 px-4 max-w-4xl mx-auto w-full">
                    <div className="flex items-center gap-3">
                        {/* Back to Admin (if applicable) */}
                        <Link
                            href="/admin"
                            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                            title="Back to Admin"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <h1 className="text-sm font-black tracking-tight" style={{ color: brandColor }}>WorkHub</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="md:hidden p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                        >
                            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                        {/* Desktop: User avatar */}
                        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-white/10 ml-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold">
                                {firstName[0]}
                            </div>
                            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{firstName}</span>
                        </div>
                    </div>
                </div>

                {/* Desktop: Horizontal tab navigation */}
                <nav className="hidden md:block border-t border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-1 px-4 max-w-4xl mx-auto overflow-x-auto hide-scrollbar">
                        {[...NAV_ITEMS, ...SECONDARY_ITEMS].map(item => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold tracking-wide whitespace-nowrap transition-all border-b-2 ${
                                    isActive(item.href)
                                        ? 'border-[var(--brand-color)] text-[var(--brand-color)]'
                                        : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                                }`}
                            >
                                {item.icon}
                                {item.label}
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
                            {[...NAV_ITEMS, ...SECONDARY_ITEMS].map(item => (
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
                                    {item.label}
                                </Link>
                            ))}

                            <div className="border-t border-neutral-200 dark:border-white/10 mt-3 pt-3">
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold">
                                        {firstName[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{userName}</p>
                                        <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Workforce</p>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        try { await del('coral-database-storage-v4'); localStorage.removeItem('coral-schema-version'); } catch {}
                                        signOut({ callbackUrl: "/" });
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" /> Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
                <TenantProvider activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds}>
                    {children}
                </TenantProvider>
            </main>

            {/* ── Mobile Bottom Nav ── */}
            <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-neutral-200 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur-xl">
                <div className="flex items-center justify-around h-16 px-1" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {BOTTOM_TABS.map(item => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all relative ${
                                isActive(item.href)
                                    ? 'text-[var(--brand-color)]'
                                    : 'text-neutral-400 active:text-neutral-600'
                            }`}
                        >
                            <div className={`transition-transform ${isActive(item.href) ? 'scale-110' : ''}`}>
                                {item.icon}
                            </div>
                            <span className="text-[9px] font-bold tracking-wider">
                                {item.mobileLabel}
                            </span>
                            {isActive(item.href) && (
                                <div
                                    className="absolute -top-px w-8 h-0.5 rounded-full"
                                    style={{ backgroundColor: 'var(--brand-color)' }}
                                />
                            )}
                        </Link>
                    ))}
                </div>
            </nav>

            <Toaster position="top-center" richColors closeButton />
        </div>
    );
}
