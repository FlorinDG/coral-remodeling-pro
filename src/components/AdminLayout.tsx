"use client";

import { useSession, signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/routing";
import {
    LayoutDashboard,
    FileText,
    Briefcase,
    Image as ImageIcon,
    LogOut,
    User,
    Menu,
    X,
    Globe,
    RefreshCw,
    Table,
    Database,
    Calendar,
    Users,
    UsersRound,
    BriefcaseBusiness,
    FileSignature,
    Landmark,
    Truck,
    CircleDollarSign,
    Settings,
    Library,
    Mail
} from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import QuickSearch from "@/components/admin/QuickSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSidebarStore, getIconComponent } from "@/store/useSidebarStore";
import { useTabStore } from "@/store/useTabStore";
import { hrTabs, relationsTabs, frontendTabs, financialTabs, settingsTabs } from "@/config/tabs";

const ALL_TABS = [...hrTabs, ...relationsTabs, ...frontendTabs, ...financialTabs, ...settingsTabs];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const { items: menuItems } = useSidebarStore();
    const { tabOrders } = useTabStore();
    const pathname = usePathname();

    return (
        <div className="min-h-screen w-full max-w-[100vw] bg-white dark:bg-black text-neutral-900 dark:text-white flex overflow-hidden">
            {/* Sidebar */}
            <aside className={`${isSidebarOpen ? 'w-56' : 'w-16'} transition-all duration-300 border-r border-neutral-200 dark:border-white/10 flex flex-col fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl`}>
                <div className="p-4 flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0">
                        <Logo />
                    </div>
                    {isSidebarOpen && <span className="font-bold tracking-tight text-sm">Admin CMS</span>}
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const IconComponent = getIconComponent(item.iconName || "");

                        // Resolve dynamic href if a custom tab order exists for this module
                        let resolvedHref = item.href as string;
                        const customOrder = tabOrders[item.id];
                        if (customOrder && customOrder.length > 0) {
                            const topTabId = customOrder[0];
                            const topTab = ALL_TABS.find(t => t.id === topTabId);
                            if (topTab) {
                                resolvedHref = topTab.href;
                            }
                        }

                        return (
                            <div key={item.id}>
                                {(() => {
                                    const isActive = resolvedHref === '/admin'
                                        ? pathname === '/admin'
                                        : pathname.startsWith(resolvedHref);

                                    return (
                                        <Link
                                            href={resolvedHref}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${isActive
                                                ? 'text-[#d35400]'
                                                : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-900 dark:text-neutral-200'
                                                }`}
                                        >
                                            {isActive ? (
                                                <div className="w-5 h-5 flex-shrink-0 text-[#d35400]">
                                                    <Logo />
                                                </div>
                                            ) : (
                                                IconComponent && <IconComponent className="w-4 h-4 text-neutral-500 group-hover:text-[#d35400] transition-colors" />
                                            )}
                                            {isSidebarOpen && <span className="text-xs font-bold">{item.label}</span>}
                                        </Link>
                                    );
                                })()}
                            </div>
                        )
                    })}
                </nav>

                <div className="p-3 mt-auto border-t border-neutral-200 dark:border-white/10">
                    <div className="flex items-center gap-3 px-2 py-3">
                        <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                            <User className="w-3 h-3 text-neutral-500" />
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold truncate">{session?.user?.name || "Admin"}</p>
                                <p className="text-[9px] text-neutral-500 truncate uppercase tracking-tighter">Administrator</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: "/admin/login" })}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        {isSidebarOpen && <span className="font-bold text-xs">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden ${isSidebarOpen ? 'pl-56' : 'pl-16'} transition-all duration-300`}>
                <header className="flex-shrink-0 h-12 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between px-6 sticky top-0 bg-white/50 dark:bg-black/50 backdrop-blur-md z-40">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            {isSidebarOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
                        </button>

                        <div className="h-4 w-px bg-neutral-200 dark:border-white/10 mx-1" />

                        <Breadcrumbs />
                    </div>

                    <div className="flex items-center gap-4">
                        <QuickSearch />

                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Sync Active</span>
                        </div>

                        <ThemeToggle />

                        <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-[#d35400] hover:text-[#e67e22] transition-colors border-l border-neutral-200 dark:border-white/10 pl-4">
                            View Site
                        </Link>
                    </div>
                </header>

                <div className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col">
                    {children}
                </div>
            </main>
        </div>
    );
}
