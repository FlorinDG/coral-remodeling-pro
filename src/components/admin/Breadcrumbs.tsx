"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ChevronRight, Home } from "lucide-react";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { useTranslations } from 'next-intl';

// Map route segments to translation keys
const BREADCRUMB_I18N: Record<string, string> = {
    dashboard: 'nav.pages.dashboard',
    settings: 'nav.sidebar.settings',
    financials: 'nav.sidebar.financials',
    contacts: 'nav.sidebar.contacts',
    suppliers: 'nav.sidebar.suppliers',
    hr: 'nav.sidebar.hr',
    library: 'nav.sidebar.library',
    projects: 'nav.sidebar.projects',
    'company-info': 'nav.settings.companyInfo',
    'ui-layout': 'nav.settings.uiLayout',
    calendar: 'nav.settings.calendar',
    invoices: 'nav.financialTabs.salesInvoices',
    quotations: 'nav.financialTabs.quotations',
};

// Max visible characters per breadcrumb segment before truncation
const MAX_SEGMENT_LEN = 12;

export default function Breadcrumbs() {
    const t = useTranslations('Admin');
    const pathname = usePathname();
    const paths = pathname.split("/").filter(Boolean);

    // Remove the locale from the paths for display
    const localeArr = ["en", "nl", "fr", "ro"];
    const filteredPaths = localeArr.includes(paths[0]) ? paths.slice(1) : paths;

    const { pageTitle } = useBreadcrumbStore();

    const getLabel = (path: string) => {
        const key = BREADCRUMB_I18N[path];
        if (key) {
            try { return t(key); } catch { /* fallback */ }
        }
        // Don't mangle UUID-like segments
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
        if (isUUID) return path.toUpperCase().substring(0, 8) + '…';
        return path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
    };

    // Truncate label with ellipsis if too long
    const truncate = (label: string) => {
        if (label.length <= MAX_SEGMENT_LEN) return label;
        return label.substring(0, MAX_SEGMENT_LEN - 1) + '…';
    };

    // Build displayable segments (skip "admin")
    const segments = filteredPaths
        .filter(p => p !== "admin")
        .map((path, _i, arr) => ({
            path,
            label: getLabel(path),
            isLast: false, // updated below
        }));

    // For deep paths (>3 segments), collapse middle ones to "…"
    let displaySegments = segments;
    if (segments.length > 3) {
        displaySegments = [
            segments[0],
            { path: '…', label: '…', isLast: false },
            segments[segments.length - 1],
        ];
    }
    if (displaySegments.length > 0) {
        displaySegments[displaySegments.length - 1].isLast = true;
    }

    return (
        <nav className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 whitespace-nowrap">
            <Link
                href="/admin/dashboard"
                className="hover:text-[var(--brand-color,#d35400)] transition-colors flex items-center gap-1 flex-shrink-0"
            >
                <Home className="w-3 h-3" />
            </Link>

            {displaySegments.map((seg) => (
                <div key={seg.path} className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="w-2.5 h-2.5 text-neutral-300 dark:text-neutral-700 flex-shrink-0" />
                    {seg.isLast && !pageTitle ? (
                        <span className="text-neutral-900 dark:text-white truncate" title={seg.label}>
                            {truncate(seg.label)}
                        </span>
                    ) : seg.path === '…' ? (
                        <span className="text-neutral-400">…</span>
                    ) : (
                        <span className="text-neutral-500 truncate" title={seg.label}>
                            {truncate(seg.label)}
                        </span>
                    )}
                </div>
            ))}

            {pageTitle && (
                <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="w-2.5 h-2.5 text-neutral-300 dark:text-neutral-700 flex-shrink-0" />
                    <span className="text-neutral-900 dark:text-white truncate" title={pageTitle}>
                        {truncate(pageTitle)}
                    </span>
                </div>
            )}
        </nav>
    );
}
