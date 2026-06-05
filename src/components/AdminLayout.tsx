"use client";

import { Toaster } from 'sonner';
import { useTranslations } from 'next-intl';

import { useSession, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { del } from 'idb-keyval';
import { Link, usePathname } from "@/i18n/routing";
import {
    LogOut,
    User,
    Menu,
    X,
    RefreshCw,
    ShieldAlert,
    Loader2,
    ShieldCheck,
    SlidersHorizontal,
    ExternalLink,
    Building2,
} from "lucide-react";
import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import UniversalSearch from "@/components/admin/UniversalSearch";
import MobileBottomNav from "@/components/admin/MobileBottomNav";
import GlobalLoadingModal from "@/components/admin/GlobalLoadingModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useSidebarStore, getIconComponent } from "@/store/useSidebarStore";
import { useTabStore } from "@/store/useTabStore";
import { hrTabs, relationsTabs, frontendTabs, financialTabs, settingsTabs } from "@/config/tabs";
import { SCHEMA_VERSION } from "@/lib/schema-version";

const ALL_TABS = [...hrTabs, ...relationsTabs, ...frontendTabs, ...financialTabs, ...settingsTabs];

import { Lock } from "lucide-react";
import { TenantProvider } from "@/context/TenantContext";

// Map sidebar item IDs to translation keys
const SIDEBAR_I18N_MAP: Record<string, string> = {
    dashboard: 'sidebar.dashboard',
    financials: 'sidebar.financials',
    contacts:   'sidebar.contacts',
    suppliers:  'sidebar.suppliers',
    settings:   'sidebar.settings',
    hr:         'sidebar.hr',
    library:    'sidebar.library',
    frontend:   'sidebar.website',
    projects:   'sidebar.projects',
    portals:    'sidebar.portals',
    calendar:   'sidebar.calendar',
    email:      'sidebar.email',
    files:      'sidebar.files',
    tasks:      'sidebar.tasks',
    sales:      'sidebar.sales',
    quotations: 'sidebar.quotations',
};

export default function AdminLayout({ children, activeModules = [], planType = 'FREE', lockedDbIds = {}, isOwner = false, subscriptionStatus = 'ACTIVE', trialEndsAt, isImpersonating = false, tenant = null }: { children: React.ReactNode, activeModules?: string[], planType?: string, lockedDbIds?: Record<string, string>, isOwner?: boolean, subscriptionStatus?: string, trialEndsAt?: string | null, isImpersonating?: boolean, tenant?: any }) {
    const t = useTranslations('Admin');
    const { data: session } = useSession();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // ── Diagnostic: log what the server layout actually passed ──
    useEffect(() => {
        console.log('[AdminLayout] Props received:', {
            planType,
            activeModules: activeModules.length,
            lockedDbIds: Object.keys(lockedDbIds).length,
            isOwner,
            isImpersonating,
            hasTenant: !!tenant,
            tenantName: tenant?.companyName,
        });
    }, []);

    // ── FREE mobile auto-redirect to /m ──────────────────────────────────
    // FREE users on a phone get the clean /m shell by default.
    // PRO/ENT are never redirected. Desktop FREE users stay in /admin.
    // The "Desktop view" link in MobileShell is the escape hatch back.
    useEffect(() => {
        if (planType !== 'FREE') return;
        try {
            const bypass = localStorage.getItem('bypass-mobile-redirect') === 'true';
            if (bypass) return;
        } catch {}
        if (window.innerWidth < 768) {
            router.replace('/m');
        }
    }, [planType, router]);
    const [companyName, setCompanyName] = useState<string>('');
    const [brandColor, setBrandColor] = useState<string>('#d35400');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
    const [resendingVerification, setResendingVerification] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [schemaStale, setSchemaStale] = useState(false);

    // ── Schema version check — enforce client update on breaking deploys ──
    useEffect(() => {
        try {
            const stored = localStorage.getItem('coral-schema-version');
            if (stored && parseInt(stored, 10) !== SCHEMA_VERSION) {
                setSchemaStale(true);
            }
            localStorage.setItem('coral-schema-version', String(SCHEMA_VERSION));
        } catch {}
    }, []);

    const isEmailVerified = session?.user?.emailVerified;
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
        if (tenant) {
            setCompanyName(tenant.commercialName || tenant.companyName || '');
            if (tenant.brandColor) {
                setBrandColor(tenant.brandColor);
                document.documentElement.style.setProperty('--brand-color', tenant.brandColor);
            }
            if (tenant.logoUrl) setLogoUrl(tenant.logoUrl);
        }

        // Listen for brand color changes from DocumentTemplatesModule
        const handleBrandColorChanged = (e: Event) => {
            const color = (e as CustomEvent<string>).detail;
            if (color) setBrandColor(color);
        };
        // PROFILE-1: Listen for full tenant profile updates (settings saves via TenantContext.refreshTenant)
        const handleTenantUpdated = (e: Event) => {
            const fresh = (e as CustomEvent).detail;
            if (fresh) {
                setCompanyName(fresh.commercialName || fresh.companyName || '');
                if (fresh.brandColor) {
                    setBrandColor(fresh.brandColor);
                    document.documentElement.style.setProperty('--brand-color', fresh.brandColor);
                }
                if (fresh.logoUrl) setLogoUrl(fresh.logoUrl);
                else setLogoUrl(null);
            }
        };
        window.addEventListener('brandColorChanged', handleBrandColorChanged);
        window.addEventListener('tenantProfileUpdated', handleTenantUpdated);
        return () => {
            window.removeEventListener('brandColorChanged', handleBrandColorChanged);
            window.removeEventListener('tenantProfileUpdated', handleTenantUpdated);
        };
    }, [tenant]);

    const { items: menuItems } = useSidebarStore();
    const { tabOrders } = useTabStore();
    const pathname = usePathname();

    const MODULE_MAP: Record<string, string[]> = {
        // 'contacts' intentionally omitted — available on all tiers (db-clients is always provisioned)
        'suppliers': ['INVOICING'],
        'email':     ['EMAIL'],
        'tasks':     ['TASKS'],
        'projects':  ['PROJECTS'],
        'portals':   ['PROJECTS'],
        'hr':        ['HR'],
        'files':     ['PROJECTS'],
        'financials':['INVOICING'],
        'calendar':  ['CALENDAR'],
        'library':   ['INVOICING'],
        'frontend':  ['WEBSITES'],
        'sales':     ['CRM'],
        'quotations':['INVOICING'],
    };

    // ── Accountant role: restrict sidebar to financial items only ──────
    const userRole = session?.user?.role ?? '';
    const isAccountant = userRole === 'ACCOUNTANT';

    // ── Role-specific sidebar allow-lists ───────────────────────────────────
    // Specialist roles see only what they need — sidebar is cosmetic,
    // middleware hard gates are the real security layer.
    const ROLE_SIDEBAR_ALLOW: Partial<Record<string, string[]>> = {
        ACCOUNTANT:      ['dashboard', 'journal', 'financials', 'contacts', 'suppliers', 'quotations', 'settings'],
        BOOKKEEPING:     ['dashboard', 'journal', 'financials', 'contacts', 'suppliers', 'library', 'settings'],
        OFFERTES:        ['dashboard', 'journal', 'quotations', 'contacts', 'library', 'projects', 'settings'],
        HR_OFFICER:      ['dashboard', 'hr', 'settings'],
        TEAMLEAD:        ['dashboard', 'journal', 'projects', 'tasks', 'calendar', 'hr', 'settings'],
        PROJECT_MANAGER: ['dashboard', 'journal', 'projects', 'tasks', 'calendar', 'contacts', 'settings'],
    };

    const isModuleLocked = (moduleId: string) => {
        // Superadmin/Impersonation bypass — sees everything
        if (isImpersonating || userRole === 'SUPERADMIN' || userRole === 'TENANT_MANAGER') return false;
        // Role-specific allow-list takes priority over module subscription gates
        const allowList = ROLE_SIDEBAR_ALLOW[userRole];
        if (allowList) return !allowList.includes(moduleId);
        // Default: check module subscription
        const requiredModules = MODULE_MAP[moduleId];
        if (!requiredModules) return false;
        return !requiredModules.some(m => activeModules.includes(m));
    };

    let activeTopPath = null;
    for (const item of menuItems) {
        // Highlighting logic: check if pathname starts with item.href
        if (item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))) {
            if (!activeTopPath || (item.href?.length || 0) > (activeTopPath.href?.length || 0)) {
                activeTopPath = item;
            }
        }
    }

    const isBlocked = activeTopPath && isModuleLocked(activeTopPath.id);

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
            {/* Sidebar — hidden on mobile, replaced by MobileBottomNav */}
            <aside className={`${isSidebarOpen ? 'w-56' : 'w-16'} transition-all duration-300 border-r border-neutral-200 dark:border-white/10 hidden md:flex flex-col fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl`}>
                <div className="p-4 flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded" />
                        ) : (
                            <RhombusLogo color={brandColor} />
                        )}
                    </div>
                    {isSidebarOpen && <span className="font-bold tracking-tight text-sm truncate">{companyName || 'Admin CMS'}</span>}
                </div>

                <nav className="flex-1 px-3 py-2 overflow-y-auto">
                    {/* ── Accountant read-only banner ── */}
                    {isAccountant && isSidebarOpen && (
                        <div className="mx-1 mb-3 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Read-only</p>
                            <p className="text-[10px] text-blue-500 dark:text-blue-400/70 mt-0.5">Accountant Access</p>
                        </div>
                    )}

                    {/* ── Platform owner quick-links (Coral Enterprises only + Superadmin bypass) ── */}
                    {(isOwner || userRole === 'SUPERADMIN') && !isAccountant && (
                        <>
                            {isSidebarOpen && (
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400 px-3 pt-3 pb-1.5">
                                    Platform
                                </p>
                            )}
                            {([
                                { href: '/superadmin',                  label: 'Superadmin',    Icon: ShieldCheck },
                                { href: '/admin/settings/company-info', label: 'ERP Config',    Icon: SlidersHorizontal },
                                { href: '/admin/content',               label: 'Website CMS',   Icon: Building2 },
                            ] as const).map(({ href, label, Icon }) => (
                                <a
                                    key={href}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white transition-colors group"
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    {isSidebarOpen && (
                                        <>
                                            <span className="text-sm font-bold flex-1">{label}</span>
                                            <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-70 transition-opacity" />
                                        </>
                                    )}
                                </a>
                            ))}

                            {/* Divider */}
                            <div className="mx-3 my-3 border-t border-neutral-200 dark:border-white/10" />

                            {isSidebarOpen && (
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400 px-3 pb-1.5">
                                    Workspace
                                </p>
                            )}
                        </>
                    )}

                    {/* ── Tenant-tier sidebar items ── */}
                    <div className="space-y-1">
                    {menuItems.filter(item => !isModuleLocked(item.id)).map((item) => {
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
                                                : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-800 dark:text-neutral-200'
                                                }`}
                                            style={isActive ? { color: brandColor } : {}}
                                        >
                                            {isActive ? (
                                                <div className="w-5 h-5 flex-shrink-0">
                                                    <RhombusLogo size={20} color={brandColor} />
                                                </div>
                                            ) : (
                                                IconComponent && <IconComponent className="w-4 h-4 text-neutral-400 dark:text-neutral-400 transition-colors" style={{}} />
                                            )}
                                            {isSidebarOpen && <span className="text-sm font-semibold flex-1 truncate">{t.has(`nav.${SIDEBAR_I18N_MAP[item.id]}`) ? t(`nav.${SIDEBAR_I18N_MAP[item.id]}`) : item.label}</span>}
                                        </Link>
                                    );
                                })()}
                            </div>
                        )
                    })}
                    </div>
                </nav>

                <div className="p-3 mt-auto border-t border-neutral-200 dark:border-white/10">
                    <div className="flex items-center gap-3 px-2 py-3">
                        <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                            <User className="w-3 h-3 text-neutral-500" />
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{session?.user?.name || "Admin"}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate uppercase tracking-tighter">{t('layout.administrator')}</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={async () => {
                            // Clear IDB database cache before logout to prevent ghost databases
                            // from leaking into the next session (cross-user contamination)
                            try {
                                await del('coral-database-storage-v4');
                                localStorage.removeItem('coral-schema-version');
                            } catch {}
                            signOut({ callbackUrl: "/" });
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        {isSidebarOpen && <span className="font-bold text-sm">{t('layout.signOut')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden ${isSidebarOpen ? 'md:pl-56' : 'md:pl-16'} transition-all duration-300 pb-16 md:pb-0`}>
                <header className="flex-shrink-0 h-12 border-b border-neutral-200 dark:border-white/10 flex items-center px-4 sm:px-6 sticky top-0 bg-white/50 dark:bg-black/50 backdrop-blur-md z-40 gap-3">
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                        >
                            {isSidebarOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
                        </button>

                        <div className="h-4 w-px bg-neutral-200 dark:border-white/10 flex-shrink-0" />

                        <div className="min-w-0 overflow-hidden hidden lg:block">
                            <Breadcrumbs />
                        </div>
                    </div>

                    {/* Center — Search */}
                    <div className="flex-1 flex items-center justify-center min-w-0 px-2">
                        <UniversalSearch />
                    </div>

                    <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">

                        <ThemeToggle />
                        <LanguageSwitcher />

                        {(planType === 'FREE') && (
                            <Link
                                href="/admin/settings/billing"
                                className="text-[10px] sm:text-xs text-white px-2.5 sm:px-4 py-1.5 rounded-full font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
                                style={{ backgroundColor: brandColor }}
                            >
                                {t('layout.upgradePlan')}
                            </Link>
                        )}

                        {/* Trial countdown badge */}
                        {subscriptionStatus === 'TRIAL' && trialEndsAt && (() => {
                            const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                            return (
                                <Link
                                    href="/admin/settings/billing"
                                    className={`text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold uppercase tracking-widest whitespace-nowrap border transition-colors ${
                                        daysLeft <= 7
                                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    }`}
                                >
                                    Trial: {daysLeft}d
                                </Link>
                            );
                        })()}

                        <a href="https://coral-group.be" target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-colors border-l border-neutral-200 dark:border-white/10 pl-3 whitespace-nowrap hidden md:block" style={{ color: brandColor }}>
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
                                {t('layout.verifyEmail')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {resendSuccess ? (
                                <span className="text-xs text-emerald-600 font-bold">{t('layout.sent')}</span>
                            ) : (
                                <button
                                    onClick={handleResendVerification}
                                    disabled={resendingVerification}
                                    className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2 flex items-center gap-1"
                                >
                                    {resendingVerification && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('layout.resend')}
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

                {/* SuperAdmin Impersonation Banner */}
                {isImpersonating && (
                    <div className="flex-shrink-0 bg-violet-600 dark:bg-violet-700 px-6 py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-4 h-4 text-violet-200 flex-shrink-0" />
                            <p className="text-xs font-bold text-white">
                                IMPERSONATION MODE (Gating-Agnostic) — You are viewing this workspace with full Enterprise/ERP access as SuperAdmin for customer support.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const { stopImpersonation } = await import('@/app/actions/superadmin');
                                    await stopImpersonation();
                                    window.location.href = '/en/superadmin';
                                } catch {
                                    window.location.href = '/en/superadmin';
                                }
                            }}
                            className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                            Exit Impersonation
                        </button>
                    </div>
                )}

                {/* Mobile Redirect Banner — retired; FREE users are now auto-redirected to /m via useEffect above. */}

                {/* Payment Failed Banner */}
                {subscriptionStatus === 'PAST_DUE' && (
                    <div className="flex-shrink-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/30 px-6 py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                            <p className="text-xs font-medium text-red-800 dark:text-red-300">
                                Your payment failed. Please update your billing information to avoid service interruption.
                            </p>
                        </div>
                        <Link
                            href="/admin/settings/billing"
                            className="text-xs font-bold text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 underline underline-offset-2 flex-shrink-0"
                        >
                            Update Billing →
                        </Link>
                    </div>
                )}

                {/* Schema update banner — non-dismissable */}
                {schemaStale && (
                    <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/30 px-6 py-2.5 flex items-center justify-center gap-3">
                        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-spin" />
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                            Een update is beschikbaar. Herlaad om door te gaan.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                        >
                            Herladen
                        </button>
                    </div>
                )}


                <div className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col relative w-full">
                    <TenantProvider activeModules={activeModules} planType={planType} lockedDbIds={lockedDbIds} tenant={tenant}>
                        {isBlocked ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 m-4">
                                <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-6" style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}30` }}>
                                    <Lock className="w-8 h-8" style={{ color: brandColor }} />
                                </div>
                                <h2 className="text-2xl font-black tracking-tight mb-3">{t('layout.moduleUpgrade')}</h2>
                                <p className="text-neutral-500 dark:text-neutral-400 max-w-md mb-8 leading-relaxed">
                                    {t('layout.moduleUpgradeDesc')}
                                </p>
                                <Link href="/admin/dashboard" className="px-6 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:opacity-90 transition-opacity">
                                    {t('layout.returnDashboard')}
                                </Link>
                            </div>
                        ) : (
                            children
                        )}
                    </TenantProvider>
                </div>
            </main>
            <GlobalLoadingModal />
            <MobileBottomNav />
            <Toaster position="top-right" richColors closeButton />
        </div>
    );
}
