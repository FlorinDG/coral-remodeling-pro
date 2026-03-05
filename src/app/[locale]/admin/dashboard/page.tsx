import prisma from "@/lib/prisma";
import {
    Users,
    Calendar,
    TrendingUp,
    ArrowUpRight,
    MessageSquare,
    Clock,
    Database,
    FileText,
    Image as ImageIcon,
    UserPlus,
    LayoutDashboard,
    PlusCircle
} from "lucide-react";
import { Link } from "@/i18n/routing";
import NotionSyncButton from "@/components/admin/NotionSyncButton";

export default async function AdminDashboard() {
    // Fetch stats
    const leadsCount = await prisma.lead.count();
    const newLeadsCount = await prisma.lead.count({ where: { status: 'NEW' } });
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
        { label: "Edit Hero", href: "/admin/content", icon: LayoutDashboard, color: "text-blue-500" },
        { label: "New Project", href: "/admin/projects/new", icon: PlusCircle, color: "text-green-500" },
        { label: "Setup Portal", href: "/admin/portals", icon: UserPlus, color: "text-[#d35400]" },
        { label: "View Portfolio", href: "/admin/projects", icon: ImageIcon, color: "text-purple-500" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between mb-2">
                <div>
                    <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-1">Administrative</h2>
                    <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
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

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Stats & Quick Actions */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((stat) => (
                            <div key={stat.label} className="bg-white dark:bg-white/[0.02] p-4 rounded-2xl border border-neutral-200 dark:border-white/5 transition-all shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                                    </div>
                                    <p className="text-neutral-500 text-[8px] font-bold uppercase tracking-widest">{stat.label}</p>
                                </div>
                                <div className="flex items-end justify-between">
                                    <p className="text-xl font-bold">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

                    {/* Recent Leads Activity */}
                    <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-neutral-200 dark:border-white/5 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-neutral-400" />
                                Recent Inquiries
                            </h3>
                            <Link href="/admin/leads" className="text-[10px] font-bold uppercase tracking-widest text-[#d35400] hover:underline">View All</Link>
                        </div>
                        <div className="divide-y divide-neutral-200 dark:divide-white/5">
                            {recentLeads.length > 0 ? recentLeads.map((lead) => (
                                <div key={lead.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-neutral-500">
                                            {lead.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{lead.name}</p>
                                            <p className="text-[10px] text-neutral-500">{lead.service}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] bg-neutral-100 dark:bg-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                            {lead.status}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center text-neutral-500 text-xs">No recent leads.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: System Controls */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-neutral-200 dark:border-white/5 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Database className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold">Notion CMS</h3>
                                <p className="text-[10px] text-neutral-500">Database synchronization</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5">
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-3">Core Content</p>
                                <NotionSyncButton endpoint="/api/notion/sync" label="Sync CMS" />
                            </div>
                            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5">
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-3">Clients & Tasks</p>
                                <NotionSyncButton endpoint="/api/notion/sync/portals" label="Sync Portals" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#d35400] rounded-3xl p-6 text-white shadow-lg shadow-[#d35400]/20 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-1">Portfolio</h3>
                            <p className="text-white/80 text-[11px] mb-4 leading-relaxed">
                                Share your latest luxury transformations with the world.
                            </p>
                            <Link
                                href="/admin/projects"
                                className="inline-flex items-center gap-2 bg-white text-[#d35400] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105"
                            >
                                Manage Projects
                            </Link>
                        </div>
                        <ImageIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
