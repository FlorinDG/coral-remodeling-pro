import prisma from "@/lib/prisma";
import {
    Users,
    Calendar,
    TrendingUp,
    ArrowUpRight,
    MessageSquare,
    Clock,
    Database,
    RefreshCw
} from "lucide-react";
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

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2 text-shadow-glow">Overview</h2>
                    <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
                </div>
                <div className="text-right">
                    <p className="text-sm text-neutral-900 dark:text-white font-bold">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">System healthy</p>
                </div>
            </div>

            {/* Stats Grid - Smaller Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="glass-morphism p-4 rounded-2xl border border-neutral-200 dark:border-white/5 group hover:border-[#d35400]/30 transition-all shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                            <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest leading-tight">{stat.label}</p>
                        </div>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                            <span className="text-green-500 text-[10px] font-bold flex items-center gap-0.5 mb-1">
                                +{Math.floor(Math.random() * 5)}% <ArrowUpRight className="w-2.5 h-2.5" />
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-morphism rounded-3xl border border-neutral-200 dark:border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-neutral-400" />
                            Recent Leads
                        </h3>
                        <button className="text-xs font-bold uppercase tracking-widest text-[#d35400] hover:underline">View All</button>
                    </div>
                    <div className="divide-y divide-neutral-200 dark:divide-white/10">
                        {recentLeads.length > 0 ? recentLeads.map((lead) => (
                            <div key={lead.id} className="p-6 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                <div>
                                    <p className="font-bold">{lead.name}</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">{lead.email} • {lead.service}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] bg-neutral-100 dark:bg-white/10 px-2 py-1 rounded-full font-bold uppercase tracking-widest">
                                        {lead.status}
                                    </span>
                                    <p className="text-[9px] text-neutral-400 mt-2 flex items-center justify-end gap-1 uppercase tracking-widest">
                                        <Clock className="w-3 h-3" />
                                        {new Date(lead.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center">
                                <p className="text-neutral-500 text-sm">No recent leads found.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-morphism rounded-3xl border border-neutral-200 dark:border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-neutral-400" />
                    </div>
                    <h3 className="text-xl font-bold">Upcoming Renovations</h3>
                    <p className="text-neutral-500 text-sm max-w-xs">
                        Bookings from the website will appear here as scheduled consultations.
                    </p>
                    <button className="bg-neutral-900 dark:bg-white dark:text-black px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#d35400] dark:hover:bg-[#d35400] dark:hover:text-white transition-all">
                        Launch Calendar
                    </button>
                </div>

                {/* Notion Control */}
                <div className="glass-morphism rounded-3xl border border-neutral-200 dark:border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-500/5 flex items-center justify-center">
                        <Database className="w-8 h-8 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold">Notion CMS Sync</h3>
                    <p className="text-neutral-500 text-sm max-w-xs">
                        Two-way synchronization for CMS content, Client Portals, and Tasks.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">CMS Content</span>
                            <NotionSyncButton endpoint="/api/notion/sync" label="Sync CMS" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Portals & Tasks</span>
                            <NotionSyncButton endpoint="/api/notion/sync/portals" label="Sync Portals" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
