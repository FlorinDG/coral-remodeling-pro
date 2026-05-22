import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
    Users, Clock, CalendarOff, CalendarClock,
    UserPlus, CalendarPlus, ClipboardCheck,
    TrendingUp, TrendingDown, Minus,
    CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { Link } from "@/i18n/routing";

// ── Types ─────────────────────────────────────────────────────────
interface KPI {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    trend?: 'up' | 'down' | 'flat';
    sub?: string;
}

interface RecentEvent {
    id: string;
    type: 'clock' | 'leave' | 'hire' | 'shift';
    description: string;
    time: string;
    icon: React.ReactNode;
    color: string;
}

// ── Server Data Fetching ──────────────────────────────────────────
// Roles that count as "employees" in HR context — must match /api/tenant/employees
const HR_EMPLOYEE_ROLES = [
    'APP_MANAGER',
    'TENANT_PRO_OWNER',
    'TENANT_PRO_EMPLOYEE',
    'TENANT_ENTERPRISE_OWNER',
    'TENANT_ENTERPRISE_MANAGER',
    'TENANT_ENTERPRISE_EMPLOYEE',
    'TENANT_ENTERPRISE_WORKFORCE',
    'BOOKKEEPING',
    'TEAMLEAD',
    'PROJECT_MANAGER',
    'HR_OFFICER',
    'OFFERTES',
];

async function getHRData(tenantId: string) {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekStartStr = startOfWeek.toISOString().split('T')[0];
    const weekEndStr = endOfWeek.toISOString().split('T')[0];

    const [
        activeEmployees,
        onLeaveEmployees,
        inactiveEmployees,
        pendingLeave,
        approvedLeave,
        shiftsThisWeek,
        recentClocks,
        recentLeaveRequests,
        recentHires,
    ] = await Promise.all([
        // Count from User table (unified source of truth — matches /api/tenant/employees)
        // Null employeeStatus = ACTIVE (legacy users created before field existed)
        prisma.user.count({ where: { tenantId, role: { in: HR_EMPLOYEE_ROLES }, OR: [{ employeeStatus: 'ACTIVE' }, { employeeStatus: null }] } }),
        prisma.user.count({ where: { tenantId, role: { in: HR_EMPLOYEE_ROLES }, employeeStatus: 'ON_LEAVE' } }),
        prisma.user.count({ where: { tenantId, role: { in: HR_EMPLOYEE_ROLES }, employeeStatus: 'INACTIVE' } }),
        prisma.timeOffRequest.count({ where: { tenantId, status: 'pending' } }),
        prisma.timeOffRequest.count({ where: { tenantId, status: 'approved' } }),
        prisma.scheduledShift.count({
            where: { tenantId, shiftDate: { gte: weekStartStr, lte: weekEndStr } }
        }),
        prisma.clockEntry.findMany({
            where: { tenantId },
            orderBy: { clockInTime: 'desc' },
            take: 5,
            select: { id: true, userId: true, clockInTime: true, clockOutTime: true },
        }),
        prisma.timeOffRequest.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, userId: true, status: true, startDate: true, endDate: true, createdAt: true, requestType: true },
        }),
        prisma.user.findMany({
            where: { tenantId, role: { in: HR_EMPLOYEE_ROLES } },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, name: true, role: true, createdAt: true },
        }),
    ]);

    // Calculate hours this week from clock entries
    const weekClocks = await prisma.clockEntry.findMany({
        where: {
            tenantId,
            clockInTime: { gte: startOfWeek, lte: endOfWeek },
        },
        select: { clockInTime: true, clockOutTime: true },
    });

    let totalHoursThisWeek = 0;
    for (const c of weekClocks) {
        if (c.clockOutTime) {
            totalHoursThisWeek += (c.clockOutTime.getTime() - c.clockInTime.getTime()) / (1000 * 60 * 60);
        }
    }

    return {
        activeEmployees,
        onLeaveEmployees,
        inactiveEmployees,
        totalEmployees: activeEmployees + onLeaveEmployees + inactiveEmployees,
        pendingLeave,
        approvedLeave,
        shiftsThisWeek,
        hoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
        recentClocks,
        recentLeaveRequests,
        recentHires,
    };
}

// ── KPI Card Component ────────────────────────────────────────────
function KPICard({ kpi }: { kpi: KPI }) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{kpi.label}</p>
                    <p className="text-3xl font-bold text-foreground tracking-tight">{kpi.value}</p>
                    {kpi.sub && (
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{kpi.sub}</p>
                    )}
                </div>
                <div className={`w-11 h-11 rounded-xl ${kpi.bgColor} flex items-center justify-center flex-shrink-0`}>
                    {kpi.icon}
                </div>
            </div>
        </div>
    );
}

// ── Headcount Bar ─────────────────────────────────────────────────
function HeadcountBar({ active, onLeave, inactive }: { active: number; onLeave: number; inactive: number }) {
    const total = active + onLeave + inactive;
    if (total === 0) return null;

    const pctActive = (active / total) * 100;
    const pctLeave = (onLeave / total) * 100;
    const pctInactive = (inactive / total) * 100;

    return (
        <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Headcount by Status</h3>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-neutral-100 dark:bg-neutral-800">
                {pctActive > 0 && (
                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pctActive}%` }} />
                )}
                {pctLeave > 0 && (
                    <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${pctLeave}%` }} />
                )}
                {pctInactive > 0 && (
                    <div className="bg-neutral-400 h-full transition-all duration-500" style={{ width: `${pctInactive}%` }} />
                )}
            </div>
            <div className="flex gap-6 mt-3 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Active ({active})
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    On Leave ({onLeave})
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                    Inactive ({inactive})
                </span>
            </div>
        </div>
    );
}

// ── Quick Action Button ───────────────────────────────────────────
function QuickAction({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
    return (
        <Link href={href} className="group">
            <div className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:shadow-md hover:border-${color}-500/50 transition-all duration-300`}>
                <div className={`w-9 h-9 rounded-lg bg-${color}-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
                <span className="text-sm font-semibold text-foreground">{label}</span>
            </div>
        </Link>
    );
}

// ── Activity Feed Item ────────────────────────────────────────────
function ActivityItem({ event }: { event: RecentEvent }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
            <div className={`w-8 h-8 rounded-full ${event.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {event.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">{event.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.time}</p>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────
export default async function HRPage() {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) redirect("/login");

    let data;
    try {
        data = await getHRData(user.tenantId);
    } catch (err) {
        console.error("[HR Dashboard] Data fetch error:", err);
        // Graceful fallback — show empty state rather than crash (PD Rule 5)
        data = {
            activeEmployees: 0, onLeaveEmployees: 0, inactiveEmployees: 0, totalEmployees: 0,
            pendingLeave: 0, approvedLeave: 0, shiftsThisWeek: 0, hoursThisWeek: 0,
            recentClocks: [], recentLeaveRequests: [], recentHires: [],
        };
    }

    // Build KPI cards
    const kpis: KPI[] = [
        {
            label: 'Active Employees',
            value: data.activeEmployees,
            icon: <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
            color: 'emerald',
            bgColor: 'bg-emerald-500/10',
            sub: `${data.totalEmployees} total headcount`,
        },
        {
            label: 'Hours This Week',
            value: data.hoursThisWeek > 0 ? `${data.hoursThisWeek}h` : '0h',
            icon: <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
            color: 'blue',
            bgColor: 'bg-blue-500/10',
            sub: 'Logged clock entries',
        },
        {
            label: 'Pending Leave',
            value: data.pendingLeave,
            icon: <CalendarOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
            color: 'amber',
            bgColor: 'bg-amber-500/10',
            sub: `${data.approvedLeave} approved`,
        },
        {
            label: 'Shifts This Week',
            value: data.shiftsThisWeek,
            icon: <CalendarClock className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
            color: 'violet',
            bgColor: 'bg-violet-500/10',
            sub: 'Scheduled across team',
        },
    ];

    // Build activity feed
    const events: RecentEvent[] = [];

    for (const c of data.recentClocks) {
        events.push({
            id: c.id,
            type: 'clock',
            description: c.clockOutTime ? `Employee clocked out` : `Employee clocked in`,
            time: new Date(c.clockInTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            icon: <Clock className="w-4 h-4 text-blue-600" />,
            color: 'bg-blue-100 dark:bg-blue-900/30',
        });
    }

    for (const lr of data.recentLeaveRequests) {
        const statusIcon = lr.status === 'approved'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            : lr.status === 'denied'
            ? <XCircle className="w-4 h-4 text-red-600" />
            : <AlertCircle className="w-4 h-4 text-amber-600" />;

        events.push({
            id: lr.id,
            type: 'leave',
            description: `Leave request (${lr.requestType || 'PTO'}) — ${lr.status}`,
            time: new Date(lr.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            icon: statusIcon,
            color: lr.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30' : lr.status === 'denied' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
        });
    }

    for (const hire of data.recentHires) {
        events.push({
            id: hire.id,
            type: 'hire',
            description: `${hire.name || 'New Employee'} added as ${hire.role}`,
            time: new Date(hire.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            icon: <UserPlus className="w-4 h-4 text-emerald-600" />,
            color: 'bg-emerald-100 dark:bg-emerald-900/30',
        });
    }

    // Sort by time descending (most recent first)
    events.sort((a, b) => b.time.localeCompare(a.time));
    const topEvents = events.slice(0, 8);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Human Resources</h1>
                        <p className="text-muted-foreground text-sm font-medium mt-1">Team overview, attendance tracking, and workforce management.</p>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {kpis.map((kpi, i) => (
                        <KPICard key={i} kpi={kpi} />
                    ))}
                </div>

                {/* Headcount Bar */}
                <div className="mb-6">
                    <HeadcountBar
                        active={data.activeEmployees}
                        onLeave={data.onLeaveEmployees}
                        inactive={data.inactiveEmployees}
                    />
                </div>

                {/* Two Column: Quick Actions + Activity Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Quick Actions */}
                    <div className="lg:col-span-1">
                        <h3 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Quick Actions</h3>
                        <div className="flex flex-col gap-3">
                            <QuickAction
                                href="/admin/hr/employees"
                                icon={<UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                label="Manage Employees"
                                color="emerald"
                            />
                            <QuickAction
                                href="/admin/hr/time-tracker/schedule"
                                icon={<CalendarPlus className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                                label="Workforce Scheduler"
                                color="violet"
                            />
                            <QuickAction
                                href="/admin/hr/leave"
                                icon={<ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                                label="Review Leave Requests"
                                color="amber"
                            />
                            <QuickAction
                                href="/admin/hr/time-tracker"
                                icon={<Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                label="Work Hub"
                                color="blue"
                            />
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="lg:col-span-2">
                        <h3 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Recent Activity</h3>
                        <div className="bg-card border border-border rounded-xl p-4">
                            {topEvents.length === 0 ? (
                                <div className="py-8 text-center">
                                    <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Clock className="w-6 h-6 text-neutral-400" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">No Recent Activity</p>
                                    <p className="text-xs text-muted-foreground mt-1">Activity will appear here as your team clocks in, requests leave, or gets scheduled.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {topEvents.map(event => (
                                        <ActivityItem key={event.id} event={event} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
