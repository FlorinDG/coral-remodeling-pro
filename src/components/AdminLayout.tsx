"use client";

import { Toaster } from 'sonner';

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
    Mail,
    ShieldAlert,
    Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import QuickSearch from "@/components/admin/QuickSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSidebarStore, getIconComponent } from "@/store/useSidebarStore";
import { useTabStore } from "@/store/useTabStore";
import { hrTabs, relationsTabs, frontendTabs, financialTabs, settingsTabs } from "@/config/tabs";

const ALL_TABS = [...hrTabs, ...relationsTabs, ...frontendTabs, ...financialTabs, ...settingsTabs];

import { Lock } from "lucide-react";
import { TenantProvider } from "@/context/TenantContext";

export default function AdminLayout({ children, activeModules = [] }: { children: React.ReactNode, activeModules?: string[] }) {
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [companyName, setCompanyName] = useState<string>('');
    const [brandColor, setBrandColor] = useState<string>('#d75d00');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
    const [resendingVerification, setResendingVerification] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const isEmailVerified = (session?.user as any)?.emailVerified;
    const userEmail = session?.user?.email;

    const handleResendVerification = async () => {
        setResendingVerification(true);
        try {
            await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail }),
            });
            setResendSuccess(true);
            setTimeout(() => setResendSuccess(false), 5000);
        } catch {} finally {
            setResendingVerification(false);
        }
    };

    useEffect(() => {
        fetch('/api/tenant/profile').then(r => r.json()).then(d => {
            if (d && !d.error) {
                setCompanyName(d.commercialName || d.companyName || '');
                if (d.brandColor) {
                    setBrandColor(d.brandColor);
                    document.documentElement.style.setProperty('--brand-color', d.brandColor);
                }
                if (d.logoUrl) setLogoUrl(d.logoUrl);
            }
        }).catch(() => {});
    }, []);

    const { items: menuItems } = useSidebarStore();
    const { tabOrders } = useTabStore();
    const pathname = usePathname();

    const MODULE_MAP: Record<string, string[]> = {
        'contacts': ['INVOICING'],
        'suppliers': ['INVOICING'],
        'email': ['CRM'],
        'tasks': ['CRM'],
        'projects': ['PROJECTS'],
        'hr': ['HR'],
        'files': ['PROJECTS'],
        'financials': ['INVOICING'],
        'calendar': ['CALENDAR'],
        'library': ['DATABASES'],
        'frontend': ['ENTERPRISE']
    };

    const filteredItems = menuItems.filter(item => {
        const requiredModules = MODULE_MAP[item.id];
        if (!requiredModules) return true;
        return requiredModules.some(m => activeModules.includes(m));
    });

    let activeTopPath = null;
    for (const item of menuItems) {
        if (item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))) {
            if (!activeTopPath || item.href.length > activeTopPath.href!.length) {
                activeTopPath = item;
            }
        }
    }

    const isBlocked = activeTopPath && !filteredItems.find(f => f.id === activeTopPath.id);

    // Rhombus SVG fallback for when no logo is uploaded
    const RhombusLogo = ({ size = 28, color }: { size?: number, color: string }) => (
        <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <rect x="14" y="2" width="15" height="15" rx="3" transform="rotate(45 14 2)" fill={color} />
        </svg>
    );

    return (
        <div
            className="min-h-screen w-full max-w-[100vw] bg-white dark:bg-black text-neutral-900 dark:text-white flex overflow-hidden"
            style={{ '--brand-color': brandColor } as React.CSSProperties}
        >
            {/* Sidebar */}
            <aside className={`${isSidebarOpen ? 'w-56' : 'w-16'} transition-all duration-300 border-r border-neutral-200 dark:border-white/10 flex flex-col fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl`}>
                <div className="p-4 flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded" />
                        ) : (
                            <RhombusLogo color={brandColor} />
                        )}
                    </div>
                    {isSidebarOpen && <span className="font-bold tracking-tight text-sm truncate">{companyName || 'Admin CMS'}</span>}
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {filteredItems.map((item) => {
                        const IconComponent = getIconComponent(item.iconName || "");

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
                                                ? ''
                                                : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-900 dark:text-neutral-200'
                                                }`}
                                            style={isActive ? { color: brandColor } : {}}
                                        >
                                            {isActive ? (
                                                <div className="w-5 h-5 flex-shrink-0">
                                                    <RhombusLogo size={20} color={brandColor} />
                                                </div>
                                            ) : (
                                                IconComponent && <IconComponent className="w-4 h-4 text-neutral-500 transition-colors" style={{}} />
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

                        <ThemeToggle />

                        {(!activeModules.includes('HR') || !activeModules.includes('DATABASES')) && (
                            <Link
                                href="/admin/settings"
                                className="text-[10px] text-white px-4 py-1.5 rounded-full font-bold uppercase tracking-widest hover:opacity-90 transition-opacity ml-2 shadow-sm"
                                style={{ backgroundColor: brandColor }}
                            >
                                Upgrade Plan
                            </Link>
                        )}

                        <a href="https://coral-group.be" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-colors border-l border-neutral-200 dark:border-white/10 pl-4 ml-2" style={{ color: brandColor }}>
                            Coral Group
                        </a>
                    </div>
                </header>

                {/* Email Verification Banner */}
                {!isEmailVerified && session?.user && !verifyBannerDismissed && (
                    <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30 px-6 py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                Please verify your email address. Check your inbox for a verification link.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {resendSuccess ? (
                                <span className="text-xs text-emerald-600 font-bold">Sent!</span>
                            ) : (
                                <button
                                    onClick={handleResendVerification}
                                    disabled={resendingVerification}
                                    className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2 flex items-center gap-1"
                                >
                                    {resendingVerification && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Resend
                                </button>
                            )}
                            <button
                                onClick={() => setVerifyBannerDismissed(true)}
                                className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 p-4 pb-16 overflow-y-auto min-h-0 flex flex-col relative w-full">
                    <TenantProvider activeModules={activeModules}>
                        {isBlocked ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 m-4">
                                <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-6" style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}30` }}>
                                    <Lock className="w-8 h-8" style={{ color: brandColor }} />
                                </div>
                                <h2 className="text-2xl font-black tracking-tight mb-3">Module Upgrade Required</h2>
                                <p className="text-neutral-500 dark:text-neutral-400 max-w-md mb-8 leading-relaxed">
                                    This specific application module requires an active premium license. Contact the Superadmin or upgrade your tenant subscription to unlock full system capabilities.
                                </p>
                                <Link href="/admin/dashboard" className="px-6 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:opacity-90 transition-opacity">
                                    Return to Dashboard
                                </Link>
                            </div>
                        ) : (
                            children
                        )}
                    </TenantProvider>
                </div>
            </main>
            <Toaster position="top-right" richColors closeButton />
        </div>
    );
}
