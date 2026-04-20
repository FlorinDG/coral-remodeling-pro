import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";
import { Receipt, TrendingUp, Users, AlertCircle, CheckCircle2, Clock, XCircle, Zap } from "lucide-react";

// Rough monthly revenue per plan (adjust to actual pricing)
const PLAN_MRR: Record<string, number> = {
    FREE:       0,
    FOUNDER:    0,   // founding cohort — no charge yet
    PRO:        49,
    ENTERPRISE: 199,
    CUSTOM:     0,
};

const PLAN_BADGE: Record<string, string> = {
    FREE:       "bg-neutral-100 text-neutral-600",
    PRO:        "bg-blue-100 text-blue-700",
    ENTERPRISE: "bg-violet-100 text-violet-700",
    FOUNDER:    "bg-amber-100 text-amber-700",
    CUSTOM:     "bg-pink-100 text-pink-700",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    ACTIVE:    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    TRIAL:     <Clock        className="w-3.5 h-3.5 text-blue-500"    />,
    INACTIVE:  <AlertCircle  className="w-3.5 h-3.5 text-yellow-500"  />,
    CANCELLED: <XCircle      className="w-3.5 h-3.5 text-red-500"     />,
};

export default async function SuperadminBillingPage() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!PLATFORM_ADMIN_ROLES.includes(role)) redirect("/nl/admin");

    const tenants = await prisma.tenant.findMany({
        select: {
            id: true,
            companyName: true,
            email: true,
            planType: true,
            subscriptionStatus: true,
            peppolSentThisMonth: true,
            peppolReceivedThisMonth: true,
            createdAt: true,
            _count: { select: { users: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    // ── Aggregations ──────────────────────────────────────────────────────────
    const active    = tenants.filter(t => t.subscriptionStatus === "ACTIVE");
    const trial     = tenants.filter(t => t.subscriptionStatus === "TRIAL");
    const cancelled = tenants.filter(t => t.subscriptionStatus === "CANCELLED");
    const mrr       = active.reduce((sum, t) => sum + (PLAN_MRR[t.planType] ?? 0), 0);
    const arr       = mrr * 12;

    const planBreakdown = Object.entries(
        tenants.reduce((acc, t) => {
            acc[t.planType] = (acc[t.planType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]);

    const totalPeppol = tenants.reduce(
        (acc, t) => ({
            sent:     acc.sent     + t.peppolSentThisMonth,
            received: acc.received + t.peppolReceivedThisMonth,
        }),
        { sent: 0, received: 0 }
    );

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-extrabold tracking-tight">Billing & Revenue</h1>
                <p className="text-neutral-500 mt-1">Subscription overview, MRR estimates, and platform usage.</p>
            </header>

            {/* ── KPI strip ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Est. MRR",       value: `€${mrr}`,          sub: `€${arr} ARR`,       icon: TrendingUp,   color: "text-emerald-500" },
                    { label: "Active",          value: active.length,      sub: "paying tenants",    icon: CheckCircle2, color: "text-emerald-500" },
                    { label: "Trials",          value: trial.length,       sub: "converting soon",   icon: Clock,        color: "text-blue-500"    },
                    { label: "Churned",         value: cancelled.length,   sub: "cancelled",         icon: XCircle,      color: "text-red-400"     },
                ].map(({ label, value, sub, icon: Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-5 py-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-2xl font-extrabold tracking-tight">{value}</p>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-0.5">{label}</p>
                                <p className="text-[11px] text-neutral-400 mt-1">{sub}</p>
                            </div>
                            <Icon className={`w-5 h-5 ${color} mt-0.5`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Two column: plan breakdown + Peppol usage ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Plan distribution */}
                <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Plan Distribution
                    </p>
                    <div className="space-y-2.5">
                        {planBreakdown.map(([plan, count]) => {
                            const pct = Math.round((count / tenants.length) * 100);
                            return (
                                <div key={plan}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PLAN_BADGE[plan] ?? "bg-neutral-100 text-neutral-600"}`}>
                                            {plan}
                                        </span>
                                        <span className="text-xs font-semibold tabular-nums">
                                            {count} <span className="text-neutral-400 font-normal">({pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-neutral-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-neutral-800 dark:bg-white rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-4 italic">
                        * MRR is estimated per plan. FOUNDER &amp; FREE tenants are not billed.
                    </p>
                </div>

                {/* Peppol platform usage */}
                <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" /> Peppol Usage this Month
                    </p>
                    <div className="space-y-4">
                        {[
                            { label: "Invoices Sent",     value: totalPeppol.sent     },
                            { label: "Invoices Received", value: totalPeppol.received },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-300">{label}</span>
                                <span className="text-2xl font-extrabold tabular-nums">{value}</span>
                            </div>
                        ))}
                    </div>

                    <hr className="my-4 border-neutral-100 dark:border-white/10" />

                    {/* Per-tenant Peppol table */}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Per Tenant</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {tenants
                            .filter(t => t.peppolSentThisMonth > 0 || t.peppolReceivedThisMonth > 0)
                            .sort((a, b) => (b.peppolSentThisMonth + b.peppolReceivedThisMonth) - (a.peppolSentThisMonth + a.peppolReceivedThisMonth))
                            .map(t => (
                                <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-neutral-50 dark:border-white/5 last:border-0">
                                    <span className="text-neutral-700 dark:text-neutral-300 truncate max-w-[180px]">{t.companyName}</span>
                                    <span className="tabular-nums text-neutral-500">
                                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{t.peppolSentThisMonth}</span> sent ·{" "}
                                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{t.peppolReceivedThisMonth}</span> recv
                                    </span>
                                </div>
                            ))
                        }
                        {tenants.every(t => t.peppolSentThisMonth === 0 && t.peppolReceivedThisMonth === 0) && (
                            <p className="text-xs text-neutral-400 italic py-2">No Peppol activity this month.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Full tenant billing table ─────────────────────────────────── */}
            <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-white/10 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-neutral-400" />
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">All Subscriptions</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm border-collapse">
                        <thead>
                            <tr className="bg-neutral-50 dark:bg-white/[0.03] border-b border-neutral-100 dark:border-white/10">
                                {["Company", "Plan", "Status", "Users", "Est. MRR", "Peppol S/R", "Joined"].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-left whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => (
                                <tr key={t.id} className="border-b border-neutral-50 dark:border-white/[0.04] last:border-0 hover:bg-neutral-50/60 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-2.5">
                                        <p className="font-semibold text-[13px]">{t.companyName}</p>
                                        {t.email && <p className="text-[11px] text-neutral-400">{t.email}</p>}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PLAN_BADGE[t.planType] ?? "bg-neutral-100 text-neutral-600"}`}>
                                            {t.planType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-1.5">
                                            {STATUS_ICON[t.subscriptionStatus]}
                                            <span className="text-[12px] text-neutral-600 dark:text-neutral-300 capitalize">
                                                {t.subscriptionStatus.toLowerCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 tabular-nums text-[12px] font-medium">
                                        {t._count.users}
                                    </td>
                                    <td className="px-4 py-2.5 tabular-nums text-[12px] font-semibold">
                                        {PLAN_MRR[t.planType] > 0
                                            ? <span className="text-emerald-600">€{PLAN_MRR[t.planType]}/mo</span>
                                            : <span className="text-neutral-400 font-normal">—</span>
                                        }
                                    </td>
                                    <td className="px-4 py-2.5 tabular-nums text-[11px] text-neutral-500">
                                        {t.peppolSentThisMonth} / {t.peppolReceivedThisMonth}
                                    </td>
                                    <td className="px-4 py-2.5 text-[11px] text-neutral-400 whitespace-nowrap">
                                        {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-neutral-50 dark:bg-white/[0.03] border-t border-neutral-200 dark:border-white/10">
                                <td className="px-4 py-2.5 text-[11px] font-bold text-neutral-500 uppercase tracking-wider" colSpan={4}>
                                    Total ({tenants.length} tenants)
                                </td>
                                <td className="px-4 py-2.5 text-[12px] font-bold text-emerald-600">
                                    €{mrr}/mo
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-neutral-500 tabular-nums">
                                    {totalPeppol.sent} / {totalPeppol.received}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
