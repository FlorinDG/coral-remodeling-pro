"use client";

import React, { useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
    LayoutDashboard, FolderKanban, CheckSquare, CalendarDays, MoreHorizontal, Camera
} from 'lucide-react';

// MOBILE-SCAN-1 (Florin 2026-10-07: "I have no way, from the mobile version of our ERP, to take a photo of a receipt and
// send it in the system"): the phone's bar had no way to a receipt. The camera sits in its middle — one tap, the photo,
// the reading, save; the ticket waits in "Te valideren" until approved.
// Loaded WITH the bar, not on demand: a page left open across a deploy asked for a code chunk that no longer exists
// (the tap failed). Nothing is fetched at tap time now.
import TicketCaptureModal from '@/components/admin/expenses/TicketCaptureModal';

interface MobileNavItem {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
}

// Core mobile tabs — keep to 5 for thumb reach
// Per Issue #7: Work Hub is the mobile homepage
const MOBILE_ITEMS: MobileNavItem[] = [
    { id: 'dashboard',  label: 'Home',      href: '/m',                         icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'tasks',      label: 'Tasks',     href: '/m/tasks',                   icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'projects',   label: 'Projects',  href: '/admin/projects-management', icon: <FolderKanban className="w-5 h-5" /> },
    { id: 'calendar',   label: 'Calendar',  href: '/admin/calendar',            icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'more',       label: 'More',      href: '/admin/settings',            icon: <MoreHorizontal className="w-5 h-5" /> },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const [capturing, setCapturing] = useState(false);

    return (
        <>
        <nav className="fixed bottom-0 inset-x-0 z-[60] md:hidden border-t border-neutral-200 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur-xl safe-area-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {MOBILE_ITEMS.map((item, i) => {
                    const isActive = (() => {
                        if (item.id === 'workhub') {
                            return pathname.startsWith('/admin/hr');
                        }
                        if (item.id === 'tasks') {
                            return pathname.startsWith('/m/tasks') || pathname.startsWith('/admin/tasks') || pathname.startsWith('/admin/database/db-tasks');
                        }
                        if (item.id === 'projects') {
                            return pathname.startsWith('/admin/projects-management') || pathname.startsWith('/admin/database/db-1');
                        }
                        if (item.id === 'calendar') {
                            return pathname.startsWith('/admin/calendar');
                        }
                        if (item.id === 'more') {
                            // Catch-all: active for any /admin route not claimed by the other 4 tabs
                            return pathname.startsWith('/admin') &&
                                !pathname.startsWith('/admin/hr') &&
                                !pathname.startsWith('/admin/tasks') &&
                                !pathname.startsWith('/admin/projects-management') &&
                                !pathname.startsWith('/admin/database/db-1') &&
                                !pathname.startsWith('/admin/database/db-tasks') &&
                                !pathname.startsWith('/admin/calendar');
                        }
                        return item.href === '/admin'
                            ? pathname === '/admin'
                            : pathname.startsWith(item.href);
                    })();

                    return (
                        <React.Fragment key={item.id}>
                        {i === 2 && (
                            <button type="button" onClick={() => setCapturing(true)} aria-label="Bonnetje scannen"
                                    className="flex flex-col items-center justify-center -mt-6">
                                <span className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                                      style={{ backgroundColor: 'var(--brand-color, #d35400)' }}>
                                    <Camera className="w-6 h-6" />
                                </span>
                                <span className="text-[10px] font-bold tracking-wider text-neutral-500 mt-0.5">Scan</span>
                            </button>
                        )}
                        <Link
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
                        </React.Fragment>
                    );
                })}
            </div>
        </nav>
        {/* OUTSIDE the bar: its backdrop blur would make the bar the containing block of a fixed full-screen modal */}
        {capturing && (
            // contained: a failure in the capture never takes the whole app down
            <ErrorBoundary componentName="TicketCaptureModal (bottom bar)" fallback={
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-6" onClick={() => setCapturing(false)}>
                    <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 text-sm text-neutral-700 dark:text-neutral-200 max-w-xs text-center space-y-3" onClick={e => e.stopPropagation()}>
                        <p>De camera kon niet geopend worden — meestal omdat de app intussen vernieuwd werd.</p>
                        <button type="button" onClick={() => window.location.reload()}
                                className="w-full h-11 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: 'var(--brand-color, #d35400)' }}>
                            Herladen
                        </button>
                    </div>
                </div>
            }>
                <TicketCaptureModal targetDatabaseId="db-tickets" onClose={() => setCapturing(false)} />
            </ErrorBoundary>
        )}
        </>
    );
}
