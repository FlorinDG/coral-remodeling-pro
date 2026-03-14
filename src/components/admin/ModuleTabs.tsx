"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { clsx } from "clsx";
import { useMemo } from "react";

export interface TabConfig {
    label: string;
    href: string;
    id: string;
}

interface ModuleTabsProps {
    tabs: TabConfig[];
}

export default function ModuleTabs({ tabs }: ModuleTabsProps) {
    const pathname = usePathname();

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
            {tabs.map((tab) => {
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
