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

export default async function AdminDashboard() {
    // Fetch generic stats
    const pendingBookingsCount = await prisma.booking.count({ where: { status: 'PENDING' } });
    const confirmedBookingsCount = await prisma.booking.count({ where: { status: 'CONFIRMED' } });
    const activePortalsCount = await prisma.clientPortal.count({ where: { status: 'ACTIVE' } });
    const openTasksCount = await prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] } } });

    const recentLeads = await prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    const stats = [
        { label: "Pending Bookings", value: pendingBookingsCount, icon: Calendar, color: "text-amber-500", bg: "bg-amber-500/10" },
        { label: "Confirmed Visits", value: confirmedBookingsCount, icon: Clock, color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Active Projects", value: activePortalsCount, icon: TrendingUp, color: "text-[#d35400]", bg: "bg-[#d35400]/10" },
        { label: "Open Tasks", value: openTasksCount, icon: Database, color: "text-blue-500", bg: "bg-blue-500/10" },
    ];

    const quickActions = [
        { label: "Edit Content", href: "/admin/content", icon: LayoutDashboard, color: "text-blue-500" },
        { label: "New Project", href: "/admin/projects/new", icon: PlusCircle, color: "text-green-500" },
        { label: "Setup Portal", href: "/admin/portals", icon: UserPlus, color: "text-[#d35400]" },
        { label: "View Portfolio", href: "/admin/projects", icon: ImageIcon, color: "text-purple-500" },
    ];

    // Chart Data Generation (Last 14 Days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const last14Days = [...Array(14)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return {
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            leads: 0,
            bookings: 0
        };
    });

    const recentLeadsData = await prisma.lead.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true }
    });

    const recentBookingsData = await prisma.booking.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true }
    });

    recentLeadsData.forEach(l => {
        const dateStr = l.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dayMatch = last14Days.find(d => d.date === dateStr);
        if (dayMatch) dayMatch.leads += 1;
    });

    recentBookingsData.forEach(b => {
        const dateStr = b.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dayMatch = last14Days.find(d => d.date === dateStr);
        if (dayMatch) dayMatch.bookings += 1;
    });

    // Status Chart Data
    const statusGroups = await prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true }
    });

    // Fallback if empty database
    let statusData = statusGroups.map(g => ({ name: g.status, value: g._count.id }));
    if (statusData.length === 0) {
        statusData = [{ name: 'NEW', value: 0 }, { name: 'CONTACTED', value: 0 }];
    }

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between mb-2">
                <div>
                    <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-1">Administrative</h2>
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

            {/* Quick Stats Grid */}
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

            {/* Main Interactive Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Area Chart */}
                <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm p-6 lg:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-[#d35400]" />
                                Acquisition Overview (14 Days)
                            </h3>
                            <p className="text-[10px] text-neutral-500 tracking-wider uppercase mt-1">Leads vs Bookings Volume</p>
                        </div>
                    </div>
                    {/* Render Client Chart Component */}
                    <OverviewAreaChart data={last14Days} />
                </div>

                {/* Status Bar Chart */}
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

            </div>

            {/* Lower Grid: Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column: Quick Actions & Controls */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        {quickActions.map((action) => (
                            <Link
                                key={action.label}
                                href={action.href}
                                className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-2xl hover:border-[#d35400]/30 transition-all group shadow-sm text-center"
                            >
                                <div className={`p-3 rounded-2xl bg-neutral-100 dark:bg-white/5 group-hover:scale-110 transition-transform`}>
                                    <action.icon className={`w-5 h-5 ${action.color}`} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{action.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Placeholder for future widgets */}
                </div>

                {/* Right Column: Recent Activity */}
                <div className="xl:col-span-2">
                    <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-neutral-200 dark:border-white/5 overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.01]">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-neutral-400" />
                                Recent Inquiries
                            </h3>
                            <Link href="/admin/leads" className="text-[10px] font-bold uppercase tracking-widest text-[#d35400] hover:underline">View All Leads</Link>
                        </div>
                        <div className="divide-y divide-neutral-200 dark:divide-white/5 flex-1 flex flex-col justify-start">
                            {recentLeads.length > 0 ? recentLeads.map((lead) => (
                                <div key={lead.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-white/5 dark:to-white/10 flex items-center justify-center text-sm font-black text-[#d35400]">
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

            </div>
        </div>
    );
}
