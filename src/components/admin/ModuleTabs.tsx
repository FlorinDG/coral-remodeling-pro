"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { clsx } from "clsx";
import { useMemo } from "react";
import { useTabStore } from "@/store/useTabStore";

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

    // Reorder tabs if a custom order exists for this group
    const orderedTabs = useMemo(() => {
        if (!groupId || !tabOrders[groupId]) return tabs;

        const customOrder = tabOrders[groupId];

        // Sort tabs based on indexing in the customOrder array
        // Any new tabs not yet in the custom order get appended to the end
        return [...tabs].sort((a, b) => {
            const indexA = customOrder.indexOf(a.id);
            const indexB = customOrder.indexOf(b.id);

            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;

            return indexA - indexB;
        });
    }, [tabs, groupId, tabOrders]);

    const activeTabId = useMemo(() => {
        // Find the most specific matching tab based on pathname
        let bestMatch: TabConfig | null = null;
        for (const tab of tabs) {
            if (pathname.includes(tab.href)) {
                if (!bestMatch || tab.href.length > bestMatch.href.length) {
                    bestMatch = tab;
                }
            }
        }
        return bestMatch?.id || tabs[0]?.id;
    }, [pathname, tabs]);

    return (
        <div className="w-full bg-white dark:bg-black border-b border-neutral-200 dark:border-white/10 px-6 pt-4 flex space-x-6 overflow-x-auto no-scrollbar shadow-sm z-10 sticky top-0">
            {orderedTabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                    <Link
                        key={tab.id}
                        href={tab.href}
                        className={clsx(
                            "pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                            isActive
                                ? "text-[#d35400] dark:text-[#e67e22]"
                                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
                        )}
                    >
                        {tab.label}
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d35400] dark:bg-[#e67e22] rounded-t-full shadow-[0_0_8px_rgba(211,84,0,0.5)]" />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
