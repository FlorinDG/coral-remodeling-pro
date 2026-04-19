import prisma from "@/lib/prisma";
import {
    FileText,
    Receipt,
    Users,
    TrendingUp,
    Clock,
    CheckCircle,
    LayoutDashboard,
    PlusCircle,
    BarChart3,
    ArrowRight,
    ShoppingCart,
    Briefcase,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { OverviewAreaChart, StatusBarChart } from "@/components/admin/dashboard/DashboardCharts";
import { auth } from "@/auth";
import { getTranslations } from 'next-intl/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count GlobalPages in a locked DB that belong to this tenant (via the DB record) */
async function countPages(databaseId: string, tenantId: string): Promise<number> {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true, _count: { select: { pages: true } } },
    });
    if (!db || db.tenantId !== tenantId) return 0;
    return db._count.pages;
}

/** Count GlobalPages matching a status property value */
async function countPagesByStatus(databaseId: string, tenantId: string, statusPropKey: string, statusOptId: string): Promise<number> {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true },
    });
    if (!db || db.tenantId !== tenantId) return 0;

    // Use raw JSON filtering — Prisma JSON path queries
    const result = await prisma.globalPage.count({
        where: {
            databaseId,
            properties: {
                path: [statusPropKey],
                equals: statusOptId,
            },
        },
    });
    return result;
}

/** Get recent GlobalPages from a DB (last N by createdAt) */
async function getRecentPages(databaseId: string, tenantId: string, take = 5) {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true },
    });
    if (!db || db.tenantId !== tenantId) return [];

    return prisma.globalPage.findMany({
        where: { databaseId },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, properties: true, createdAt: true },
    });
}

/** Read monthly financial totals from GlobalPage properties */
async function getMonthlyFinancials(databaseId: string, tenantId: string, sixMonthsAgo: Date) {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true },
    });
    if (!db || db.tenantId !== tenantId) return [];

    return prisma.globalPage.findMany({
        where: {
            databaseId,
            createdAt: { gte: sixMonthsAgo },
        },
        select: { properties: true, createdAt: true },
    });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    if (!tenantId) {
        return <div className="p-12 text-center text-red-500 font-bold">Unauthorized. Tenant context missing.</div>;
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { activeModules: true, companyName: true, vatNumber: true, planType: true },
    });

    const activeModules = tenant?.activeModules || [];
    const hasInvoicing = activeModules.includes("INVOICING");
    const hasCRM = activeModules.includes("CRM");
    const hasProjects = activeModules.includes("PROJECTS");

    const t = await getTranslations('Admin');

    // ── Date windows ──────────────────────────────────────────────────────────
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(currentMonth);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    // ── KPI counts via GlobalPage (the real DB) ────────────────────────────────
    const [
        totalSalesInvoices,
        totalPurchaseInvoices,
        totalClients,
        totalSuppliers,
        totalQuotations,
        totalTasks,
        totalProjects,
        openTasksCount,
        draftInvoicesCount,
    ] = await Promise.all([
        hasInvoicing ? countPages('db-invoices', tenantId) : Promise.resolve(0),
        hasInvoicing ? countPages('db-expenses', tenantId) : Promise.resolve(0),
        hasInvoicing ? countPages('db-clients', tenantId) : Promise.resolve(0),
        hasInvoicing ? countPages('db-suppliers', tenantId) : Promise.resolve(0),
        hasInvoicing ? countPages('db-quotations', tenantId) : Promise.resolve(0),
        hasCRM ? countPages('db-tasks', tenantId) : Promise.resolve(0),
        hasProjects ? countPages('db-projects', tenantId) : Promise.resolve(0),
        hasCRM ? countPagesByStatus('db-tasks', tenantId, 'prop-task-status', 'opt-todo') : Promise.resolve(0),
        hasInvoicing ? countPagesByStatus('db-invoices', tenantId, 'status', 'opt-draft') : Promise.resolve(0),
    ]);

    // ── Stats strips ──────────────────────────────────────────────────────────
    const stats = [
        ...(hasInvoicing ? [
            {
                label: 'Sales Invoices',
                value: totalSalesInvoices,
                icon: FileText,
                color: "text-blue-500",
                bg: "bg-blue-500/10",
                href: "/admin/financials/income/invoices",
            },
            {
                label: 'Purchase Invoices',
                value: totalPurchaseInvoices,
                icon: Receipt,
                color: "text-amber-500",
                bg: "bg-amber-500/10",
                href: "/admin/financials/expenses/invoices",
            },
            {
                label: 'Clients',
                value: totalClients,
                icon: Users,
                color: "text-purple-500",
                bg: "bg-purple-500/10",
                href: "/admin/contacts",
            },
            {
                label: 'Quotations',
                value: totalQuotations,
                icon: ShoppingCart,
                color: "text-green-500",
                bg: "bg-green-500/10",
                href: "/admin/quotations",
            },
        ] : []),
        ...(hasCRM ? [
            {
                label: 'Open Tasks',
                value: openTasksCount,
                icon: CheckCircle,
                color: "text-orange-500",
                bg: "bg-orange-500/10",
                href: "/admin/calendar",
            },
        ] : []),
        ...(hasProjects ? [
            {
                label: 'Projects',
                value: totalProjects,
                icon: Briefcase,
                color: "text-indigo-500",
                bg: "bg-indigo-500/10",
                href: "/admin/projects",
            },
        ] : []),
    ];

    // ── Financial chart from GlobalPage properties ────────────────────────────
    const last6Months = [...Array(6)].map((_, i) => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - (5 - i));
        return {
            date: d.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
            invoiced: 0,
            expenditures: 0,
            month: d.getMonth(),
            year: d.getFullYear(),
        };
    });

    if (hasInvoicing) {
        const [salesPages, purchasePages] = await Promise.all([
            getMonthlyFinancials('db-invoices', tenantId, sixMonthsAgo),
            getMonthlyFinancials('db-expenses', tenantId, sixMonthsAgo),
        ]);

        for (const page of salesPages) {
            const props = page.properties as Record<string, any>;
            // Try totalIncVat first, fall back to amount
            const amount = Number(props['totalIncVat'] ?? props['total'] ?? props['amount'] ?? 0);
            if (!amount) continue;
            const m = page.createdAt.getMonth();
            const y = page.createdAt.getFullYear();
            const slot = last6Months.find(s => s.month === m && s.year === y);
            if (slot) slot.invoiced += amount;
        }

        for (const page of purchasePages) {
            const props = page.properties as Record<string, any>;
            const amount = Number(props['totalIncVat'] ?? props['total'] ?? props['amount'] ?? 0);
            if (!amount) continue;
            const m = page.createdAt.getMonth();
            const y = page.createdAt.getFullYear();
            const slot = last6Months.find(s => s.month === m && s.year === y);
            if (slot) slot.expenditures += amount;
        }
    }

    const sumInvoiced = last6Months.reduce((sum, m) => sum + m.invoiced, 0);

    // ── Invoice status distribution for bar chart ─────────────────────────────
    let statusData: { name: string; value: number }[] = [];
    if (hasInvoicing) {
        const db = await prisma.globalDatabase.findUnique({
            where: { id: 'db-invoices' },
            select: { id: true, tenantId: true },
        });
        if (db && db.tenantId === tenantId) {
            const pages = await prisma.globalPage.findMany({
                where: { databaseId: 'db-invoices' },
                select: { properties: true },
            });
            const counts: Record<string, number> = {};
            for (const p of pages) {
                const props = p.properties as Record<string, any>;
                const status = String(props['status'] || 'opt-draft');
                // Convert option IDs to display labels
                const label = status === 'opt-draft' ? 'Draft'
                    : status === 'opt-sent' ? 'Sent'
                    : status === 'opt-paid' ? 'Paid'
                    : status === 'opt-overdue' ? 'Overdue'
                    : status === 'opt-partial' ? 'Partial'
                    : status.replace('opt-', '');
                counts[label] = (counts[label] || 0) + 1;
            }
            statusData = Object.entries(counts).map(([name, value]) => ({ name, value }));
        }
        if (statusData.length === 0) {
            statusData = [{ name: 'Draft', value: 0 }, { name: 'Sent', value: 0 }, { name: 'Paid', value: 0 }];
        }
    }

    // ── Recent invoices for activity feed ─────────────────────────────────────
    const recentInvoicePages = hasInvoicing ? await getRecentPages('db-invoices', tenantId, 5) : [];
    const recentInvoices = recentInvoicePages.map(p => {
        const props = p.properties as Record<string, any>;
        return {
            id: p.id,
            title: String(props['title'] || 'Untitled'),
            client: String(props['clientName'] || props['client'] || '—'),
            status: String(props['status'] || 'opt-draft'),
            amount: Number(props['totalIncVat'] ?? props['total'] ?? 0),
            createdAt: p.createdAt,
        };
    });

    // ── Quick actions ─────────────────────────────────────────────────────────
    const quickActions = [
        ...(hasInvoicing ? [
            { label: 'New Invoice', href: "/admin/financials/income/invoices", icon: FileText, color: "text-blue-500" },
            { label: 'New Client', href: "/admin/contacts", icon: Users, color: "text-purple-500" },
        ] : []),
        ...(hasProjects ? [
            { label: 'New Project', href: "/admin/projects", icon: Briefcase, color: "text-green-500" },
        ] : []),
        { label: 'Settings', href: "/admin/settings", icon: LayoutDashboard, color: "text-neutral-500" },
    ].slice(0, 4);

    const isBlankState = sumInvoiced === 0 && (!tenant?.companyName || !tenant?.vatNumber) && stats.every(s => s.value === 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-end justify-between mb-2">
                <div>
                    <h2 className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--brand-color, #d35400)' }}>
                        {t('dashboard.administrative')}
                    </h2>
                    <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
                </div>
                <div className="text-right">
                    <p className="text-xs text-neutral-900 dark:text-white font-bold">
                        {new Date().toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                        <div className="w-1 h-1 rounded-full bg-green-500" />
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest leading-none">{t('dashboard.healthy')}</span>
                    </div>
                </div>
            </div>

            {/* Onboarding hero — only shown when DB is genuinely empty */}
            {isBlankState && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden mb-6">
                    <div className="absolute -top-10 -right-10 p-8 opacity-10 pointer-events-none">
                        <LayoutDashboard className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h2 className="text-2xl sm:text-3xl font-black mb-2">{t('dashboard.welcomeTitle')}</h2>
                        <p className="text-blue-100 mb-8 text-sm leading-relaxed">{t('dashboard.welcomeDesc')}</p>
                        <div className="flex flex-col gap-3">
                            <Link href="/admin/settings/company-info" className="flex items-center gap-4 bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-xl transition-colors border border-white/10 group">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold shrink-0 shadow-inner group-hover:scale-110 transition-transform">1</span>
                                <div><h4 className="font-bold text-sm sm:text-base">{t('dashboard.step1Title')}</h4><p className="text-xs text-blue-200">{t('dashboard.step1Desc')}</p></div>
                            </Link>
                            <Link href="/admin/contacts" className="flex items-center gap-4 bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-xl transition-colors border border-white/10 group">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold shrink-0 shadow-inner group-hover:scale-110 transition-transform">2</span>
                                <div><h4 className="font-bold text-sm sm:text-base">{t('dashboard.step2Title')}</h4><p className="text-xs text-blue-200">{t('dashboard.step2Desc')}</p></div>
                            </Link>
                            <Link href="/admin/financials/income/invoices" className="flex items-center gap-4 bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-xl transition-colors border border-white/10 group">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold shrink-0 shadow-inner group-hover:scale-110 transition-transform">3</span>
                                <div><h4 className="font-bold text-sm sm:text-base">{t('dashboard.step3Title')}</h4><p className="text-xs text-blue-200">{t('dashboard.step3Desc')}</p></div>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Grid */}
            {stats.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat) => (
                        <Link
                            key={stat.label}
                            href={stat.href}
                            className="bg-white dark:bg-white/[0.02] p-4 rounded-2xl border border-neutral-200 dark:border-white/5 transition-all shadow-sm flex items-center justify-between hover:border-[var(--brand-color,#d35400)]/30 group"
                        >
                            <div>
                                <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black mt-1">{stat.value}</p>
                            </div>
                            <div className={`p-2 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

                {/* Area Chart — 6-month financials */}
                <div className={`bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm p-6 ${hasInvoicing ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                                {t('dashboard.financialOverview')}
                            </h3>
                            <p className="text-[10px] text-neutral-500 tracking-wider uppercase mt-1">{t('dashboard.invoicedVsExpend')}</p>
                        </div>
                        {draftInvoicesCount > 0 && (
                            <Link href="/admin/financials/income/invoices" className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 transition-colors">
                                <Clock className="w-3 h-3" />
                                {draftInvoicesCount} Draft{draftInvoicesCount !== 1 ? 's' : ''}
                            </Link>
                        )}
                    </div>
                    <OverviewAreaChart data={last6Months} />
                </div>

                {/* Invoice Status Bar Chart */}
                {hasInvoicing && (
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm p-6 flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-purple-500" />
                                Invoice Status
                            </h3>
                            <p className="text-[10px] text-neutral-500 tracking-wider uppercase mt-1">Current Volume</p>
                        </div>
                        <div className="flex-1 flex items-end">
                            <StatusBarChart data={statusData} />
                        </div>
                    </div>
                )}
            </div>

            {/* Lower Grid: Quick Actions + Recent Invoice Activity */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Quick Actions */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {quickActions.map((action) => (
                            <Link
                                key={action.label}
                                href={action.href}
                                className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-2xl hover:border-[var(--brand-color,#d35400)]/30 transition-all group shadow-sm text-center"
                            >
                                <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-white/5 group-hover:scale-110 transition-transform">
                                    <action.icon className={`w-5 h-5 ${action.color}`} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{action.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Summary totals pill */}
                    {hasInvoicing && (
                        <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-neutral-200 dark:border-white/5 p-4 shadow-sm">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-3">6-Month Summary</p>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Total Invoiced</span>
                                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                                        €{sumInvoiced.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Total Expenses</span>
                                    <span className="text-sm font-black text-red-500 dark:text-red-400">
                                        €{last6Months.reduce((s, m) => s + m.expenditures, 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="h-px bg-neutral-100 dark:bg-white/5 my-1" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Net</span>
                                    <span className={`text-sm font-black ${(sumInvoiced - last6Months.reduce((s, m) => s + m.expenditures, 0)) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        €{(sumInvoiced - last6Months.reduce((s, m) => s + m.expenditures, 0)).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Invoices Activity */}
                {hasInvoicing && (
                    <div className="xl:col-span-2">
                        <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-neutral-200 dark:border-white/5 overflow-hidden shadow-sm h-full flex flex-col">
                            <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.01]">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-neutral-400" />
                                    Recent Invoices
                                </h3>
                                <Link href="/admin/financials/income/invoices" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:underline" style={{ color: 'var(--brand-color, #d35400)' }}>
                                    View All
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                            <div className="divide-y divide-neutral-100 dark:divide-white/5 flex-1 flex flex-col">
                                {recentInvoices.length > 0 ? recentInvoices.map((inv) => {
                                    const statusLabel = inv.status === 'opt-draft' ? 'Draft'
                                        : inv.status === 'opt-sent' ? 'Sent'
                                        : inv.status === 'opt-paid' ? 'Paid'
                                        : inv.status === 'opt-overdue' ? 'Overdue'
                                        : inv.status === 'opt-partial' ? 'Partial'
                                        : inv.status.replace('opt-', '');
                                    const statusColor = inv.status === 'opt-paid' ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                        : inv.status === 'opt-overdue' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                        : inv.status === 'opt-sent' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                        : 'bg-neutral-100 dark:bg-white/10 text-neutral-500';
                                    return (
                                        <div key={inv.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-500/20 flex items-center justify-center shrink-0">
                                                    <FileText className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{inv.title}</p>
                                                    <p className="text-[10px] text-neutral-500">{inv.client}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-neutral-700 dark:text-neutral-300">
                                                    {inv.amount > 0 ? `€${inv.amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                </span>
                                                <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-widest ${statusColor}`}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="p-12 text-center text-neutral-400 text-xs my-auto flex flex-col items-center gap-3">
                                        <FileText className="w-8 h-8 text-neutral-200 dark:text-neutral-700" />
                                        <p>No invoices yet.</p>
                                        <Link href="/admin/financials/income/invoices" className="text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: 'var(--brand-color, #d35400)' }}>
                                            <PlusCircle className="w-3 h-3" /> Create your first invoice
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
