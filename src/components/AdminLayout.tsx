"use client";

import { useSession, signOut } from "next-auth/react";
import { Link } from "@/i18n/routing";
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
    Database
} from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import QuickSearch from "@/components/admin/QuickSearch";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
        { icon: FileText, label: "Site Content", href: "/admin/content" },
        { icon: Briefcase, label: "Services", href: "/admin/services" },
        { icon: ImageIcon, label: "Portfolio", href: "/admin/projects" },
        { icon: User, label: "Client Portals", href: "/admin/portals" },
        { icon: RefreshCw, label: "Notion Sync", href: "/admin/notion-sync" },
        { icon: Table, label: "Spreadsheet", href: "/admin/spreadsheet" },
        { icon: Database, label: "Database", href: "/admin/database" },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex">
            {/* Sidebar */}
            <aside className={`${isSidebarOpen ? 'w-56' : 'w-16'} transition-all duration-300 border-r border-neutral-200 dark:border-white/10 flex flex-col fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl`}>
                <div className="p-4 flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0">
                        <Logo />
                    </div>
                    {isSidebarOpen && <span className="font-bold tracking-tight text-sm">Admin CMS</span>}
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {menuItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href as string}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                        >
                            <item.icon className="w-4 h-4 text-neutral-500 group-hover:text-[#d35400] transition-colors" />
                            {isSidebarOpen && <span className="font-bold text-xs">{item.label}</span>}
                        </Link>
                    ))}
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
            <main className={`flex-1 ${isSidebarOpen ? 'pl-56' : 'pl-16'} transition-all duration-300`}>
                <header className="h-12 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between px-6 sticky top-0 bg-white/50 dark:bg-black/50 backdrop-blur-md z-40">
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

                        <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-[#d35400] hover:text-[#e67e22] transition-colors border-l border-neutral-200 dark:border-white/10 pl-4">
                            View Site
                        </Link>
                    </div>
                </header>

                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
