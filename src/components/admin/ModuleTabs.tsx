"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { clsx } from "clsx";
import { useMemo } from "react";
import { useTabStore } from "@/store/useTabStore";
import { useTenant } from "@/context/TenantContext";
import { useTranslations } from 'next-intl';
import { getFinancialTabs, getSettingsTabs } from "@/config/tabs";

export interface TabConfig {
    label: string;
    href: string;
    id: string;
}

interface ModuleTabsProps {
    tabs: TabConfig[];
    groupId?: string;
}

export default function ModuleTabs({ tabs, groupId }: ModuleTabsProps) {
    const pathname = usePathname();
    const { tabOrders } = useTabStore();
    const { activeModules } = useTenant();
    const t = useTranslations('Admin');

    // Auto-resolve localized tabs for known groups
    const resolvedTabs = useMemo(() => {
        const tFn = (key: string) => t(key);
        const tHasFn = (key: string) => t.has(key);
        if (groupId === 'financials') return getFinancialTabs(tFn, tHasFn);
        if (groupId === 'settings') return getSettingsTabs(tFn, tHasFn);
        return tabs;
    }, [tabs, groupId, t]);

    const allowedTabs = useMemo(() => {
        const SETTINGS_MODULE_MAP: Record<string, string[]> = {
            'opt-relations': ['CRM'],
            'opt-tasks': ['CRM'],
            'opt-projects': ['PROJECTS'],
            'opt-calendar': ['CALENDAR'],
            'opt-hr': ['HR'],
            'opt-library': ['DATABASES'],
            'databases': ['DATABASES'],
            'pipeline': ['CRM'],
            'opt-website': ['HR'],
            'ui': ['CRM'],           // Bind Layout mapping to Pro
            'integrations': ['CRM'],  // Bind Integrations mapping to Pro
            'opt-financials': ['CRM'] // Strip off Financial Settings from Free
        };
        return resolvedTabs.filter(tab => {
            const req = SETTINGS_MODULE_MAP[tab.id];
            if (!req) return true;
            return req.some(m => activeModules.includes(m));
        });
    }, [resolvedTabs, activeModules]);

    // Reorder tabs if a custom order exists for this group
    const orderedTabs = useMemo(() => {
        if (!groupId || !tabOrders[groupId]) return allowedTabs;

        const customOrder = tabOrders[groupId];

        // Safely extract whatever tabs exist in the saved cache order
        const ordered = customOrder.map(id => allowedTabs.find(t => t.id === id)).filter(Boolean) as TabConfig[];

        // Identify any newly injected tabs that aren't inside the cache yet
        const missing = allowedTabs.filter(t => !customOrder.includes(t.id));

        // Deterministically append the missing tabs to the bottom of the list without relying on V8 sorting quirks
        return [...ordered, ...missing];
    }, [allowedTabs, groupId, tabOrders]);

    const activeTabId = useMemo(() => {
        // Find the most specific matching tab based on pathname
        let bestMatch: TabConfig | null = null;
        for (const tab of allowedTabs) {
            if (pathname.includes(tab.href)) {
                if (!bestMatch || tab.href.length > bestMatch.href.length) {
                    bestMatch = tab;
                }
            }
        }
        return bestMatch?.id || allowedTabs[0]?.id;
    }, [pathname, allowedTabs]);

    return (
        <div className="w-full bg-white dark:bg-black border-b border-neutral-200 dark:border-white/10 px-6 pt-4 flex space-x-6 overflow-x-auto no-scrollbar shadow-sm z-10 sticky top-0 flex-shrink-0">
            {orderedTabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                    <Link
                        key={tab.id}
                        href={tab.href}
                        className={clsx(
                            "pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                            isActive
                                ? ""
                                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
                        )}
                        style={isActive ? { color: 'var(--brand-color, #d35400)' } : {}}
                    >
                        {tab.label}
                        {isActive && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)', boxShadow: '0 0 8px var(--brand-color, rgba(211,84,0,0.5))' }}
                            />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
