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
    X
} from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
        { icon: FileText, label: "Site Content", href: "/admin/content" },
        { icon: Briefcase, label: "Services", href: "/admin/services" },
        { icon: ImageIcon, label: "Portfolio", href: "/admin/projects" },
        { icon: User, label: "Client Portals", href: "/admin/portals" },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex">
            {/* Sidebar */}
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 border-r border-neutral-200 dark:border-white/10 flex flex-col fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl`}>
                <div className="p-6 flex items-center gap-4">
                    <div className="w-8 h-8 flex-shrink-0">
                        <Logo />
                    </div>
                    {isSidebarOpen && <span className="font-bold tracking-tight">Admin CMS</span>}
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href as string}
                            className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                        >
                            <item.icon className="w-5 h-5 text-neutral-500 group-hover:text-[#d35400] transition-colors" />
                            {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 mt-auto border-t border-neutral-200 dark:border-white/10">
                    <div className="flex items-center gap-4 px-4 py-4">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                            <User className="w-4 h-4 text-neutral-500" />
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{session?.user?.name || "Admin User"}</p>
                                <p className="text-[10px] text-neutral-500 truncate uppercase mt-0.5 tracking-tighter">Administrator</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: "/admin/login" })}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {isSidebarOpen && <span className="font-medium text-sm">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 ${isSidebarOpen ? 'pl-64' : 'pl-20'} transition-all duration-300`}>
                <header className="h-16 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between px-8 sticky top-0 bg-white/50 dark:bg-black/50 backdrop-blur-md z-40">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xs font-bold uppercase tracking-widest text-[#d35400] hover:text-[#e67e22] transition-colors">
                            View Website
                        </Link>
                    </div>
                </header>

                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
