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
    Database,
    Calendar,
    ChevronDown,
    ChevronUp,
    Users,
    UsersRound,
    BriefcaseBusiness,
    FileSignature,
    Landmark,
    Truck,
    CircleDollarSign
} from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import QuickSearch from "@/components/admin/QuickSearch";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['Front End']);

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev =>
            prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
        );
    };

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
        {
            icon: Globe,
            label: "Front End",
            children: [
                { label: "Pages / Content", href: "/admin/content" },
                { label: "Services", href: "/admin/services" },
                { label: "Portfolio", href: "/admin/projects" },
            ]
        },
        { icon: UsersRound, label: "CRM", href: "/admin/crm" },
        { icon: Users, label: "Clients", href: "/admin/clients" },
        { icon: FileSignature, label: "Quotations", href: "/admin/quotations" },
        { icon: BriefcaseBusiness, label: "Projects", href: "/admin/projects-management" },
        {
            icon: Landmark,
            label: "Financials",
            children: [
                {
                    label: "Income",
                    isSubCategory: true,
                    children: [
                        { label: "Invoices", href: "/admin/financials/income/invoices" },
                        { label: "Credit Notes", href: "/admin/financials/income/credit-notes" }
                    ]
                },
                {
                    label: "Expenses",
                    isSubCategory: true,
                    children: [
                        { label: "Invoices", href: "/admin/financials/expenses/invoices" },
                        { label: "Credit Notes", href: "/admin/financials/expenses/credit-notes" }
                    ]
                }
            ]
        },
        { icon: CircleDollarSign, label: "HR", href: "/admin/hr" },
        { icon: Truck, label: "Suppliers", href: "/admin/suppliers" },
        { icon: User, label: "Client Portals", href: "/admin/portals" },
        { icon: RefreshCw, label: "Notion Sync", href: "/admin/notion-sync" },
        { icon: Calendar, label: "Calendar", href: "/admin/calendar" },
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

                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <div key={item.label}>
                            {item.children ? (
                                <>
                                    <button
                                        onClick={() => toggleMenu(item.label)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="w-4 h-4 text-neutral-500 group-hover:text-[#d35400] transition-colors" />
                                            {isSidebarOpen && <span className="font-bold text-xs">{item.label}</span>}
                                        </div>
                                        {isSidebarOpen && (
                                            expandedMenus.includes(item.label)
                                                ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#d35400]" />
                                                : <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#d35400]" />
                                        )}
                                    </button>

                                    {/* Nested Items */}
                                    {isSidebarOpen && expandedMenus.includes(item.label) && (
                                        <div className="mt-1 ml-4 pl-3 border-l border-neutral-200 dark:border-white/10 space-y-1">
                                            {item.children.map((child: any) => (
                                                <div key={child.label}>
                                                    {child.isSubCategory ? (
                                                        <>
                                                            <div className="px-3 py-1.5 mt-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                                {child.label}
                                                            </div>
                                                            <div className="space-y-1 pl-2">
                                                                {child.children.map((subChild: any) => (
                                                                    <Link
                                                                        key={subChild.label}
                                                                        href={subChild.href as string}
                                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-neutral-600 dark:text-neutral-400 hover:text-[#d35400] dark:hover:text-[#d35400]"
                                                                    >
                                                                        <span className="font-medium text-xs">{subChild.label}</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <Link
                                                            href={child.href as string}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-neutral-600 dark:text-neutral-400 hover:text-[#d35400] dark:hover:text-[#d35400]"
                                                        >
                                                            <span className="font-medium text-xs">{child.label}</span>
                                                        </Link>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
                                    href={item.href as string}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                                >
                                    <item.icon className="w-4 h-4 text-neutral-500 group-hover:text-[#d35400] transition-colors" />
                                    {isSidebarOpen && <span className="font-bold text-xs">{item.label}</span>}
                                </Link>
                            )}
                        </div>
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
