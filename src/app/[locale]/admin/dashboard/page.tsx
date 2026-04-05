import prisma from "@/lib/prisma";
import {
    Users,
    Calendar,
    TrendingUp,
    MessageSquare,
    Clock,
    Database,
    Image as ImageIcon,
    UserPlus,
    LayoutDashboard,
    PlusCircle,
    BarChart3
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { OverviewAreaChart, StatusBarChart } from "@/components/admin/dashboard/DashboardCharts";
import DashboardProjectsTable from "@/components/admin/dashboard/DashboardProjectsTable";
import { auth } from "@/auth";

export default async function AdminDashboard() {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    if (!tenantId) {
        return <div className="p-12 text-center text-red-500 font-bold">Unauthorized. Tenant context missing.</div>;
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { activeModules: true, companyName: true, vatNumber: true }
    });

    const activeModules = tenant?.activeModules || [];
    const hasCRM = activeModules.includes("CRM");
    const hasProjects = activeModules.includes("PROJECTS");

    // Fetch generic stats only if they have access
    const pendingBookingsCount = hasCRM ? await prisma.booking.count({ where: { status: 'PENDING', tenantId } }) : 0;
    const confirmedBookingsCount = hasCRM ? await prisma.booking.count({ where: { status: 'CONFIRMED', tenantId } }) : 0;
    const activePortalsCount = hasProjects ? await prisma.clientPortal.count({ where: { status: 'ACTIVE', tenantId } }) : 0;
    const openTasksCount = hasCRM ? await prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] }, portal: { tenantId } } }) : 0;

    const recentLeads = hasCRM ? await prisma.lead.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' }
    }) : [];

    const stats = [
        ...(hasCRM ? [
            { label: "Pending Bookings", value: pendingBookingsCount, icon: Calendar, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Confirmed Visits", value: confirmedBookingsCount, icon: Clock, color: "text-green-500", bg: "bg-green-500/10" }
        ] : []),
        ...(hasProjects ? [
            { label: "Active Projects", value: activePortalsCount, icon: TrendingUp, color: "text-[var(--brand-color,#d35400)]", bg: "bg-[var(--brand-color,#d35400)]/10" }
        ] : []),
        ...(hasCRM ? [
            { label: "Open Tasks", value: openTasksCount, icon: Database, color: "text-blue-500", bg: "bg-blue-500/10" }
        ] : [])
    ];

    const quickActions = [
        { label: "Edit Content", href: "/admin/content", icon: LayoutDashboard, color: "text-blue-500" },
        { label: "New Project", href: "/admin/projects/new", icon: PlusCircle, color: "text-green-500" },
        { label: "Setup Portal", href: "/admin/portals", icon: UserPlus, color: "text-[var(--brand-color,#d35400)]" },
        { label: "View Portfolio", href: "/admin/projects", icon: ImageIcon, color: "text-purple-500" },
    ];

    // Chart Data Generation (Last 6 Months: Financials)
    const currentMonth = new Date();
    currentMonth.setDate(1);

    // Create baseline 6 months array
    const last6Months = [...Array(6)].map((_, i) => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - (5 - i));
        return {
            date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            invoiced: 0,
            expenditures: 0,
            month: d.getMonth(),
            year: d.getFullYear(),
        };
    });

    const sixMonthsAgo = new Date(currentMonth);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const invoices = await prisma.invoice.findMany({
        where: { issueDate: { gte: sixMonthsAgo }, tenantId },
        select: { issueDate: true, type: true, total: true }
    });

    invoices.forEach(inv => {
        const invMonth = inv.issueDate.getMonth();
        const invYear = inv.issueDate.getFullYear();

        const monthMatch = last6Months.find(m => m.month === invMonth && m.year === invYear);
        if (monthMatch) {
            if (inv.type === 'SALES') {
                monthMatch.invoiced += inv.total;
            } else {
                monthMatch.expenditures += inv.total;
            }
        }
    });

    // Status Chart Data
    let statusData: any[] = [];
    if (hasCRM) {
        const statusGroups = await prisma.lead.groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { id: true }
        });

        // Fallback if empty database
        statusData = statusGroups.map(g => ({ name: g.status, value: g._count.id }));
        if (statusData.length === 0) {
            statusData = [{ name: 'NEW', value: 0 }, { name: 'CONTACTED', value: 0 }];
        }
    }

    const sumInvoiced = last6Months.reduce((sum, m) => sum + m.invoiced, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between mb-2">
                <div>
                    <h2 className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--brand-color, #d35400)' }}>Administrative</h2>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                </div>
                <div className="text-right">
                    <p className="text-xs text-neutral-900 dark:text-white font-bold">
                        {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                        <div className="w-1 h-1 rounded-full bg-green-500" />
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest leading-none">Healthy</span>
                    </div>
                </div>
            </div>

            {/* The Empty State Onboarding Hero */}
            {sumInvoiced === 0 && (!tenant?.companyName || !tenant?.vatNumber) && stats.every(s => s.value === 0) && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden mb-6">
                    <div className="absolute -top-10 -right-10 p-8 opacity-10 pointer-events-none">
                        <LayoutDashboard className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h2 className="text-2xl sm:text-3xl font-black mb-2">Welcome to CoralOS Premium!</h2>
                        <p className="text-blue-100 mb-8 text-sm leading-relaxed">Your secure workspace is officially provisioned and isolated. Let's get your first legal documents ready to send. Follow these 3 critical steps:</p>

                        <div className="flex flex-col gap-3">
                            <Link href="/admin/settings/company-info" className="flex items-center gap-4 bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-xl transition-colors border border-white/10 group">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold shrink-0 shadow-inner group-hover:scale-110 transition-transform">1</span>
                                <div>
                                    <h4 className="font-bold text-sm sm:text-base">Set up your Company Identity</h4>
                                    <p className="text-xs text-blue-200">Upload your Logo, VAT, and IBAN so clients can legally pay you.</p>
                                </div>
                            </Link>

                            <Link href="/admin/database/db-clients" className="flex items-center gap-4 bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-xl transition-colors border border-white/10 group">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold shrink-0 shadow-inner group-hover:scale-110 transition-transform">2</span>
                                <div>
                                    <h4 className="font-bold text-sm sm:text-base">Scaffold your Database</h4>
                                    <p className="text-xs text-blue-200">Instantiate the immutable CRM systems to store your Contacts.</p>
                                </div>
                            </Link>

                            <Link href="/admin/financials/income/invoices" className="flex items-center gap-4 bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-xl transition-colors border border-white/10 group">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold shrink-0 shadow-inner group-hover:scale-110 transition-transform">3</span>
                                <div>
                                    <h4 className="font-bold text-sm sm:text-base">Generate your first Invoice</h4>
                                    <p className="text-xs text-blue-200">Test the mathematical engine and export your first premium PDF.</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats Grid */}
            {stats.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat) => (
                        <div key={stat.label} className="bg-white dark:bg-white/[0.02] p-4 rounded-2xl border border-neutral-200 dark:border-white/5 transition-all shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black mt-1">{stat.value}</p>
                            </div>
                            <div className={`p-2 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Active Projects Pipeline & Telemetry */}
            {hasProjects && (
                <div className="mt-6">
                    <DashboardProjectsTable />
                </div>
            )}

            {/* Main Interactive Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

                {/* Main Area Chart */}
                <div className={`bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm p-6 ${hasCRM ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                                Financial Overview
                            </h3>
                            <p className="text-[10px] text-neutral-500 tracking-wider uppercase mt-1">Invoiced vs Expenditures (6 Months)</p>
                        </div>
                    </div>
                    {/* Render Client Chart Component */}
                    <OverviewAreaChart data={last6Months} />
                </div>

                {/* Status Bar Chart */}
                {hasCRM && (
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm p-6 flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <Users className="w-4 h-4 text-purple-500" />
                                Lead Status Spread
                            </h3>
                            <p className="text-[10px] text-neutral-500 tracking-wider uppercase mt-1">Current volume by status</p>
                        </div>
                        <div className="flex-1 flex items-end">
                            <StatusBarChart data={statusData} />
                        </div>
                    </div>
                )}

            </div>

            {/* Lower Grid: Quick Actions & Recent Activity */}
            {(hasCRM || hasProjects) && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Left Column: Quick Actions & Controls */}
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-4">
                            {quickActions.map((action) => (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-2xl hover:border-[var(--brand-color,#d35400)]/30 transition-all group shadow-sm text-center"
                                >
                                    <div className={`p-3 rounded-2xl bg-neutral-100 dark:bg-white/5 group-hover:scale-110 transition-transform`}>
                                        <action.icon className={`w-5 h-5 ${action.color}`} />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{action.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Recent Activity */}
                    {hasCRM && (
                        <div className="xl:col-span-2">
                            <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-neutral-200 dark:border-white/5 overflow-hidden shadow-sm h-full flex flex-col">
                                <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.01]">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-neutral-400" />
                                        Recent Inquiries
                                    </h3>
                                    <Link href="/admin/leads" className="text-[10px] font-bold uppercase tracking-widest hover:underline" style={{ color: 'var(--brand-color, #d35400)' }}>View All Leads</Link>
                                </div>
                                <div className="divide-y divide-neutral-200 dark:divide-white/5 flex-1 flex flex-col justify-start">
                                    {recentLeads.length > 0 ? recentLeads.map((lead) => (
                                        <div key={lead.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-white/5 dark:to-white/10 flex items-center justify-center text-sm font-black" style={{ color: 'var(--brand-color, #d35400)' }}>
                                                    {lead.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{lead.name}</p>
                                                    <p className="text-[10px] text-neutral-500">{lead.service}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-widest ${lead.status === 'NEW' ? 'bg-blue-500/10 text-blue-500' :
                                                    lead.status === 'CONTACTED' ? 'bg-amber-500/10 text-amber-500' :
                                                        'bg-neutral-100 dark:bg-white/10'
                                                    }`}>
                                                    {lead.status}
                                                </span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-12 text-center text-neutral-500 text-xs my-auto">No recent leads found in database.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
