"use client";

import React, { useState, useTransition } from "react";
import {
    Building2, Users, LayoutTemplate, Loader2, Check,
    RefreshCw, Trash2, Mail, ChevronDown, Activity,
    Zap, MoreHorizontal, FolderOpen,
} from "lucide-react";
import {
    updateTenantSubscription,
    toggleTenantModule,
    resetPeppolCounters,
    deleteTenant,
} from "@/app/actions/superadmin";

// ── Constants ────────────────────────────────────────────────────────────────

const PLAN_TYPES        = ["FREE", "PRO", "ENTERPRISE", "FOUNDER", "CUSTOM"] as const;
const SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIAL", "INACTIVE", "CANCELLED"] as const;

const MODULES: { key: string; label: string }[] = [
    { key: "INVOICING",  label: "INV"  },
    { key: "CRM",        label: "CRM"  },
    { key: "DATABASES",  label: "DB"   },
    { key: "PROJECTS",   label: "PRJ"  },
    { key: "CALENDAR",   label: "CAL"  },
    { key: "HR",         label: "HR"   },
];

const PLAN_USER_LIMITS: Record<string, number | null> = {
    FREE: 1, PRO: 3, ENTERPRISE: null, FOUNDER: null, CUSTOM: null,
};

const PLAN_BADGE: Record<string, string> = {
    FREE:       "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
    PRO:        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    ENTERPRISE: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    FOUNDER:    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    CUSTOM:     "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
};

const STATUS_BADGE: Record<string, string> = {
    ACTIVE:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    TRIAL:     "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    INACTIVE:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

// ── Type ─────────────────────────────────────────────────────────────────────

type Tenant = {
    id: string;
    companyName: string;
    email: string | null;
    logoUrl: string | null;
    planType: string;
    subscriptionStatus: string;
    activeModules: string[];
    peppolSentThisMonth: number;
    peppolReceivedThisMonth: number;
    createdAt: Date;
    _count: { users: number; clientPortals: number; internalProjects: number };
    users: { email: string | null; name: string | null; role: string }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function peppolColor(val: number, cap: number | null, soft = false): string {
    if (!cap) return "text-neutral-400";
    const pct = val / cap;
    if (pct >= 1) return soft ? "text-amber-600 font-bold" : "text-red-600 font-bold";
    if (pct >= 0.8) return soft ? "text-amber-500" : "text-orange-500";
    return "text-neutral-500 dark:text-neutral-400";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TenantsGrid({ initialTenants }: { initialTenants: Tenant[] }) {
    const [isPending, startTransition] = useTransition();
    const [expanded, setExpanded]       = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [openMenu, setOpenMenu]       = useState<string | null>(null);

    // ── Actions ──────────────────────────────────────────────────────────────

    const handlePlan = (id: string, status: string, plan: string) =>
        startTransition(() => updateTenantSubscription(id, status, plan));

    const handleModule = (id: string, mod: string, active: boolean) =>
        startTransition(() => toggleTenantModule(id, mod, !active));

    const handleReset = (id: string) =>
        startTransition(() => resetPeppolCounters(id));

    const handleDelete = (id: string) =>
        startTransition(async () => { await deleteTenant(id); setConfirmDelete(null); });

    // ── Stats ────────────────────────────────────────────────────────────────

    const total    = initialTenants.length;
    const active   = initialTenants.filter(t => t.subscriptionStatus === "ACTIVE").length;
    const founders = initialTenants.filter(t => t.planType === "FOUNDER").length;
    const capLeft  = 20 - founders;

    return (
        <div className="flex flex-col gap-4">

            {/* ── Stats bar ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                    { label: "Total",   value: total,   icon: Building2,  cls: "text-blue-500"   },
                    { label: "Active",  value: active,  icon: Activity,   cls: "text-emerald-500" },
                    { label: "Founders",value: founders, icon: Zap,       cls: "text-amber-500"  },
                    { label: "Cap left",value: capLeft, icon: Users,
                      cls: capLeft <= 0 ? "text-red-500" : "text-neutral-400" },
                ] as const).map(({ label, value, icon: Icon, cls }) => (
                    <div key={label} className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${cls}`} />
                        <div>
                            <p className="text-base font-bold leading-none">{value}</p>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-0.5">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Table ──────────────────────────────────────────────────── */}
            <div className="w-full overflow-x-auto rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
                <table className="w-full min-w-[900px] text-sm border-collapse">

                    {/* Header */}
                    <thead>
                        <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                            {["#", "Company", "Plan", "Status", "Users", "Peppol", "Modules", "Joined", ""].map((h, i) => (
                                <th
                                    key={i}
                                    className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-left whitespace-nowrap
                                        ${i === 0 ? "w-8 text-center" : ""}
                                        ${h === "" ? "w-8" : ""}
                                    `}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {initialTenants.map((t, idx) => {
                            const isExpanded = expanded === t.id;
                            const adminUser  = t.users?.find(u => u.role === "APP_MANAGER") ?? t.users?.[0];
                            const userLimit  = PLAN_USER_LIMITS[t.planType];
                            // Peppol caps by plan
                            const sentCap    = t.planType === "FREE" ? 5 : null;
                            const recvCap    = t.planType === "FREE" ? 10 : null;

                            return (
                                <React.Fragment key={t.id}>
                                    {/* ── Main row ── */}
                                    <tr
                                        className={`border-b border-neutral-100 dark:border-white/[0.06] transition-colors
                                            ${isPending ? "opacity-50 pointer-events-none" : ""}
                                            ${isExpanded ? "bg-neutral-50/80 dark:bg-white/[0.04]" : "hover:bg-neutral-50/50 dark:hover:bg-white/[0.03]"}
                                        `}
                                    >
                                        {/* # */}
                                        <td className="px-3 py-2.5 text-center text-[11px] text-neutral-400 tabular-nums">
                                            {idx + 1}
                                        </td>

                                        {/* Company */}
                                        <td className="px-3 py-2.5 min-w-[190px]">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-white/10 border border-neutral-200 dark:border-white/10 flex items-center justify-center shrink-0">
                                                    {t.logoUrl
                                                        ? <img src={t.logoUrl} alt="" className="w-4 h-4 object-contain rounded" />
                                                        : <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                                                    }
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-[13px] truncate leading-tight">{t.companyName}</p>
                                                    {adminUser?.email && (
                                                        <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-2.5 h-2.5 shrink-0" />
                                                            {adminUser.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Plan */}
                                        <td className="px-3 py-2.5">
                                            <select
                                                value={t.planType}
                                                onChange={e => handlePlan(t.id, t.subscriptionStatus, e.target.value)}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider appearance-none cursor-pointer border-none outline-none ${PLAN_BADGE[t.planType] ?? PLAN_BADGE.FREE}`}
                                            >
                                                {PLAN_TYPES.map(p => <option key={p} value={p} className="bg-white text-black">{p}</option>)}
                                            </select>
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-2.5">
                                            <select
                                                value={t.subscriptionStatus}
                                                onChange={e => handlePlan(t.id, e.target.value, t.planType)}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider appearance-none cursor-pointer border-none outline-none ${STATUS_BADGE[t.subscriptionStatus] ?? STATUS_BADGE.INACTIVE}`}
                                            >
                                                {SUBSCRIPTION_STATUSES.map(s => <option key={s} value={s} className="bg-white text-black">{s}</option>)}
                                            </select>
                                        </td>

                                        {/* Users */}
                                        <td className="px-3 py-2.5 tabular-nums text-[12px]">
                                            <span className="font-semibold">{t._count.users}</span>
                                            {userLimit !== null && (
                                                <span className={`text-neutral-400 ${t._count.users >= userLimit ? "text-red-500 font-bold" : ""}`}>
                                                    /{userLimit}
                                                </span>
                                            )}
                                        </td>

                                        {/* Peppol */}
                                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-[11px]">
                                            <span className={peppolColor(t.peppolSentThisMonth, sentCap)}>
                                                {t.peppolSentThisMonth}{sentCap ? `/${sentCap}` : ""}
                                            </span>
                                            <span className="text-neutral-300 dark:text-neutral-600 mx-1">·</span>
                                            <span className={peppolColor(t.peppolReceivedThisMonth, recvCap, true)}>
                                                {t.peppolReceivedThisMonth}{recvCap ? `/${recvCap}` : ""}
                                            </span>
                                        </td>

                                        {/* Modules */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {MODULES.map(({ key, label }) => {
                                                    const on = t.activeModules?.includes(key);
                                                    return (
                                                        <button
                                                            key={key}
                                                            title={key}
                                                            onClick={() => handleModule(t.id, key, on ?? false)}
                                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                                                                on
                                                                ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                                                                : "bg-neutral-100 text-neutral-400 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10"
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>

                                        {/* Joined */}
                                        <td className="px-3 py-2.5 text-[11px] text-neutral-400 whitespace-nowrap tabular-nums">
                                            {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                                        </td>

                                        {/* ⋯ menu */}
                                        <td className="px-2 py-2.5 relative">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                                                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                                                    title="Expand"
                                                >
                                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                </button>
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                                                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                                                    >
                                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                                    </button>
                                                    {openMenu === t.id && (
                                                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 w-44">
                                                            <button
                                                                onClick={() => { handleReset(t.id); setOpenMenu(null); }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                                Reset Peppol counters
                                                            </button>
                                                            <div className="h-px bg-neutral-100 dark:bg-white/5 my-1" />
                                                            {confirmDelete === t.id ? (
                                                                <div className="px-3 pb-2">
                                                                    <p className="text-[10px] text-red-500 font-bold mb-1.5">Delete all tenant data?</p>
                                                                    <div className="flex gap-1.5">
                                                                        <button
                                                                            onClick={() => { handleDelete(t.id); setOpenMenu(null); }}
                                                                            className="flex-1 text-[10px] font-bold py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                                                        >
                                                                            Confirm
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { setConfirmDelete(null); setOpenMenu(null); }}
                                                                            className="flex-1 text-[10px] font-bold py-1 border border-neutral-200 dark:border-white/10 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setConfirmDelete(t.id)}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                    Delete tenant
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {isPending && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* ── Expanded detail row ── */}
                                    {isExpanded && (
                                        <tr className="bg-neutral-50/80 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/10">
                                            <td colSpan={9} className="px-8 py-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

                                                    {/* Users list */}
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1.5">
                                                            <Users className="w-3 h-3" /> Workspace users
                                                        </p>
                                                        {t.users?.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {t.users.map((u, i) => (
                                                                    <div key={i} className="flex items-center gap-2 text-xs">
                                                                        <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                                            <span className="text-[8px] font-bold uppercase text-neutral-500 dark:text-neutral-300">
                                                                                {(u.name || u.email || "?")[0]}
                                                                            </span>
                                                                        </div>
                                                                        <span className="truncate text-neutral-600 dark:text-neutral-300">{u.email || u.name || "Unknown"}</span>
                                                                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                                                            {u.role.replace(/_/g, " ").replace("APP MANAGER", "MGR")}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-neutral-400 italic">No users yet</p>
                                                        )}
                                                    </div>

                                                    {/* Workspace stats */}
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1.5">
                                                            <FolderOpen className="w-3 h-3" /> Workspace
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            {[
                                                                { label: "Client portals",    val: t._count.clientPortals,  icon: LayoutTemplate },
                                                                { label: "Projects",          val: t._count.internalProjects, icon: FolderOpen },
                                                            ].map(({ label, val, icon: Icon }) => (
                                                                <div key={label} className="flex items-center gap-2 text-xs">
                                                                    <Icon className="w-3 h-3 text-neutral-400 shrink-0" />
                                                                    <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
                                                                    <span className="font-semibold ml-auto">{val}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Peppol detail + reset */}
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1.5">
                                                            <Zap className="w-3 h-3" /> Peppol this month
                                                        </p>
                                                        <div className="space-y-1.5 mb-3">
                                                            {[
                                                                { label: "Sent",     val: t.peppolSentThisMonth,     cap: sentCap, soft: false },
                                                                { label: "Received", val: t.peppolReceivedThisMonth, cap: recvCap, soft: true  },
                                                            ].map(({ label, val, cap, soft }) => (
                                                                <div key={label} className="flex items-center gap-2 text-xs">
                                                                    <span className="text-neutral-500 dark:text-neutral-400 w-16">{label}</span>
                                                                    <div className="flex-1 bg-neutral-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all ${
                                                                                cap && val / cap >= 1
                                                                                    ? soft ? "bg-amber-500" : "bg-red-500"
                                                                                    : cap && val / cap >= 0.8
                                                                                        ? "bg-orange-400"
                                                                                        : "bg-emerald-500"
                                                                            }`}
                                                                            style={{ width: cap ? `${Math.min(100, (val / cap) * 100)}%` : "0%" }}
                                                                        />
                                                                    </div>
                                                                    <span className={`font-semibold tabular-nums ${peppolColor(val, cap, soft)}`}>
                                                                        {val}{cap ? `/${cap}` : ""}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            onClick={() => handleReset(t.id)}
                                                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-700 dark:hover:text-white border border-neutral-200 dark:border-white/10 px-2.5 py-1.5 rounded-lg hover:border-neutral-400 dark:hover:border-white/30 transition-all"
                                                        >
                                                            <RefreshCw className="w-3 h-3" /> Reset counters
                                                        </button>
                                                    </div>

                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {/* Click-outside dismiss for open menu */}
                {openMenu && (
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => { setOpenMenu(null); setConfirmDelete(null); }}
                    />
                )}
            </div>
        </div>
    );
}
