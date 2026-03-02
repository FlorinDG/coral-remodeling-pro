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
    const bookingsCount = await prisma.booking.count();
    const portalCount = await prisma.clientPortal.count();

    const recentLeads = await prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    const stats = [
        { label: "Total Leads", value: leadsCount, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Bookings", value: bookingsCount, icon: Calendar, color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Project Portals", value: portalCount, icon: TrendingUp, color: "text-[#d35400]", bg: "bg-[#d35400]/10" },
        { label: "Notion Status", value: "Connected", icon: Database, color: "text-purple-500", bg: "bg-purple-500/10" },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Overview</h2>
                    <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
                </div>
                <p className="text-sm text-neutral-500 font-medium">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/10 group hover:border-[#d35400]/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className="text-green-500 text-xs font-bold flex items-center gap-1">
                                +0% <ArrowUpRight className="w-3 h-3" />
                            </span>
                        </div>
                        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-3xl font-bold">{stat.value}</p>
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
