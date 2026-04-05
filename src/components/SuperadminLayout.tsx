"use client";

import { useSession, signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/routing";
import { LogOut, LayoutDashboard, Building2, Receipt, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();

    const navItems = [
        { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/superadmin/tenants", label: "Tenants", icon: Building2 },
        { href: "/superadmin/billing", label: "Billing", icon: Receipt },
    ];

    return (
        <div className="min-h-screen w-full bg-white dark:bg-black text-neutral-900 dark:text-white flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 transition-all duration-300 border-r border-neutral-200 dark:border-white/10 flex flex-col fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
                <div className="p-4 flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0 text-red-600">
                        <Logo />
                    </div>
                    <span className="font-bold tracking-tight text-sm text-red-600">Coral SaaS Vault</span>
                </div>

                <div className="px-4 py-2">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-red-500" />
                        Superadmin Mode
                    </span>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive
                                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-bold'
                                        : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 group-hover:text-red-500'}`} />
                                <span className="text-xs">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 mt-auto border-t border-neutral-200 dark:border-white/10">
                    <button
                        onClick={() => signOut({ callbackUrl: "/admin/login" })}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="font-bold text-xs">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden pl-56 transition-all duration-300">
                <header className="h-14 border-b border-neutral-200 dark:border-white/10 px-6 flex items-center justify-between sticky top-0 bg-white/50 dark:bg-black/50 backdrop-blur-md z-40">
                    <h2 className="text-sm font-semibold tracking-tight">System Master Control</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] uppercase font-bold text-neutral-500">System Online</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-6 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
