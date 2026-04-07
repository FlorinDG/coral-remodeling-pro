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
        // Don't mangle UUID-like segments (contains only hex chars and hyphens)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
        if (isUUID) return path.toUpperCase().substring(0, 8) + '…';
        return path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
    };
    return (
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            <Link
                href="/admin/dashboard"
                className="hover:text-[var(--brand-color,#d35400)] transition-colors flex items-center gap-1"
            >
                <Home className="w-3 h-3" />
                <span>Admin</span>
            </Link>

            {filteredPaths.map((path, index) => {
                if (path === "admin") return null;

                const href = `/${filteredPaths.slice(0, index + 1).join("/")}`;
                const label = getLabel(path);
                const isLast = index === filteredPaths.length - 1;

                return (
                    <div key={path} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-neutral-300 dark:text-neutral-700" />
                        {isLast && !pageTitle ? (
                            <span className="text-neutral-900 dark:text-white">{label}</span>
                        ) : (
                            <span className="text-neutral-500 whitespace-nowrap">
                                {label}
                            </span>
                        )}
                    </div>
                );
            })}

            {pageTitle && (
                <div className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-neutral-300 dark:text-neutral-700" />
                    <span className="text-neutral-900 dark:text-white">{pageTitle}</span>
                </div>
            )}
        </nav>
    );
}
