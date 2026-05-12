import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CalendarOff, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import LeaveActions from "./LeaveActions";

// ── Server Data ───────────────────────────────────────────────────
async function getLeaveData(tenantId: string) {
    const requests = await prisma.timeOffRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    // Get employee names for user IDs
    const userIds = [...new Set(requests.map(r => r.userId))];
    const employees = await prisma.employee.findMany({
        where: { tenantId, id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
    });
    // Also try to look up by the HR database pages (if employees are stored there)
    const nameMap = new Map<string, string>();
    for (const e of employees) {
        nameMap.set(e.id, `${e.firstName} ${e.lastName}`);
    }

    return { requests, nameMap };
}

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
        pending: {
            bg: 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-500/20',
            text: 'text-amber-700 dark:text-amber-400',
            icon: <AlertCircle className="w-3 h-3" />,
        },
        approved: {
            bg: 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/20',
            text: 'text-emerald-700 dark:text-emerald-400',
            icon: <CheckCircle2 className="w-3 h-3" />,
        },
        denied: {
            bg: 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-500/20',
            text: 'text-red-700 dark:text-red-400',
            icon: <XCircle className="w-3 h-3" />,
        },
    };

    const cfg = configs[status] || configs.pending;

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
            {cfg.icon}
            {status}
        </span>
    );
}

function formatDate(dateStr: string) {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// ── Main Page ─────────────────────────────────────────────────────
export default async function LeavePage() {
    const session = await auth();
    const user = session?.user;
    if (!user?.tenantId) redirect("/login");

    let data;
    try {
        data = await getLeaveData(user.tenantId);
    } catch (err) {
        console.error("[Leave] Data fetch error:", err);
        data = { requests: [], nameMap: new Map<string, string>() };
    }

    const pendingCount = data.requests.filter(r => r.status === 'pending').length;
    const approvedCount = data.requests.filter(r => r.status === 'approved').length;
    const deniedCount = data.requests.filter(r => r.status === 'denied').length;

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Leave Management</h1>
                        <p className="text-muted-foreground text-sm font-medium mt-1">Review and manage time-off requests from your team.</p>
                    </div>
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{pendingCount}</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Pending</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{approvedCount}</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Approved</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">{deniedCount}</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600/70 dark:text-red-400/70">Denied</p>
                    </div>
                </div>

                {/* Leave Requests Table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {data.requests.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <CalendarOff className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">No Leave Requests</h3>
                            <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                                Leave requests from employees will appear here. Employees can submit requests from their mobile WorkHub view.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-border bg-neutral-50 dark:bg-white/[0.02]">
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Period</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Submitted</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.requests.map((req) => (
                                        <tr key={req.id} className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-sm text-foreground">
                                                    {data.nameMap.get(req.userId) || req.userId.slice(0, 8)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-muted-foreground capitalize font-medium">
                                                    {req.requestType || 'Vacation'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-foreground font-medium">
                                                    {formatDate(req.startDate)} — {formatDate(req.endDate)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={req.status} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-muted-foreground font-medium">
                                                    {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {req.status === 'pending' ? (
                                                    <LeaveActions requestId={req.id} />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
