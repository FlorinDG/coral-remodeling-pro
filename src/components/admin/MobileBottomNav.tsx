"use client";

import React from 'react';
import { Link, usePathname } from '@/i18n/routing';
import {
    LayoutDashboard, Receipt, FolderKanban, CheckSquare, CalendarDays,
    Users2, Settings, MoreHorizontal
} from 'lucide-react';

interface MobileNavItem {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
}

// Core mobile tabs — keep to 5 for thumb reach
// Per Issue #7: Work Hub is the mobile homepage
const MOBILE_ITEMS: MobileNavItem[] = [
    { id: 'workhub',    label: 'Home',      href: '/admin/hr/time-tracker',     icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'tasks',      label: 'Tasks',     href: '/admin/tasks',               icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'projects',   label: 'Projects',  href: '/admin/projects-management', icon: <FolderKanban className="w-5 h-5" /> },
    { id: 'calendar',   label: 'Calendar',  href: '/admin/calendar',            icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'more',       label: 'More',      href: '/admin/settings',            icon: <MoreHorizontal className="w-5 h-5" /> },
];

export default function MobileBottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 inset-x-0 z-[60] md:hidden border-t border-neutral-200 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur-xl safe-area-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {MOBILE_ITEMS.map(item => {
                    const isActive = (() => {
                        if (item.id === 'workhub') {
                            return pathname.startsWith('/admin/hr');
                        }
                        if (item.id === 'tasks') {
                            return pathname.startsWith('/admin/tasks') || pathname.startsWith('/admin/database/db-tasks');
                        }
                        if (item.id === 'projects') {
                            return pathname.startsWith('/admin/projects-management') || pathname.startsWith('/admin/database/db-1');
                        }
                        if (item.id === 'calendar') {
                            return pathname.startsWith('/admin/calendar');
                        }
                        if (item.id === 'more') {
                            return pathname.startsWith('/admin/settings') || 
                                   pathname.startsWith('/admin/crm') || 
                                   pathname.startsWith('/admin/database/db-clients') ||
                                   pathname.startsWith('/admin/database/db-suppliers') ||
                                   pathname.startsWith('/admin/database/db-quotations') ||
                                   pathname.startsWith('/admin/database/db-invoices') ||
                                   pathname.startsWith('/admin/database/db-expenses') ||
                                   pathname.startsWith('/admin/database/db-tickets');
                        }
                        return item.href === '/admin'
                            ? pathname === '/admin'
                            : pathname.startsWith(item.href);
                    })();

                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
                                isActive
                                    ? 'text-[var(--brand-color,#d35400)]'
                                    : 'text-neutral-400 dark:text-neutral-500 active:text-neutral-600'
                            }`}
                        >
                            <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] font-bold tracking-wider ${isActive ? '' : 'text-neutral-400'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div
                                    className="absolute top-0 w-8 h-0.5 rounded-full"
                                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                                />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
