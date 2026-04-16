"use client";

import { useState, useTransition } from "react";
import {
    Building2, Users, LayoutTemplate, Loader2, Check,
    RefreshCw, Trash2, Mail, ChevronDown, Activity, Zap,
} from "lucide-react";
import {
    updateTenantSubscription,
    toggleTenantModule,
    resetPeppolCounters,
    deleteTenant,
} from "@/app/actions/superadmin";

const AVAILABLE_MODULES = ["CRM", "PROJECTS", "INVOICING", "CALENDAR", "DATABASES", "HR"];
const PLAN_TYPES        = ["FREE", "PRO", "ENTERPRISE", "FOUNDER", "CUSTOM"];
const SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIAL", "INACTIVE", "CANCELLED"];

const PLAN_COLORS: Record<string, string> = {
    FREE:       "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
    PRO:        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    ENTERPRISE: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    FOUNDER:    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    CUSTOM:     "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
};

const STATUS_COLORS: Record<string, string> = {
    ACTIVE:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    TRIAL:     "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    INACTIVE:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

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

export default function TenantsGrid({ initialTenants }: { initialTenants: Tenant[] }) {
    const [isPending, startTransition] = useTransition();
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const handlePlanChange = (tenantId: string, status: string, plan: string) => {
        startTransition(async () => {
            await updateTenantSubscription(tenantId, status, plan);
        });
    };

    const handleModuleToggle = (tenantId: string, moduleName: string, currentlyActive: boolean) => {
        startTransition(async () => {
            await toggleTenantModule(tenantId, moduleName, !currentlyActive);
        });
    };

    const handleResetPeppol = (tenantId: string) => {
        startTransition(async () => {
            await resetPeppolCounters(tenantId);
        });
    };

    const handleDelete = (tenantId: string) => {
        startTransition(async () => {
            await deleteTenant(tenantId);
            setConfirmDelete(null);
        });
    };

    // Global stats header
    const totalTenants  = initialTenants.length;
    const activeTenants = initialTenants.filter(t => t.subscriptionStatus === "ACTIVE").length;
    const founderCount  = initialTenants.filter(t => t.planType === "FOUNDER").length;

    return (
        <div className="space-y-6">
            {/* ── Platform stats bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total tenants",   value: totalTenants,  icon: Building2, color: "text-blue-500"    },
                    { label: "Active",           value: activeTenants, icon: Activity,  color: "text-emerald-500" },
                    { label: "Founders",         value: founderCount,  icon: Zap,       color: "text-amber-500"   },
                    { label: "Cap remaining",    value: 20 - founderCount, icon: Users, color: founderCount >= 20 ? "text-red-500" : "text-neutral-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-4 flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                        <div>
                            <div className="text-xl font-bold">{value}</div>
                            <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Tenant cards ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {initialTenants.map((t) => {
                    const isExpanded = expanded === t.id;
                    const tenantAdmin = t.users?.find(u => u.role === "TENANT_ADMIN") ?? t.users?.[0];

                    return (
                        <div
                            key={t.id}
                            className={`bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md transition-all relative ${isPending ? "opacity-60 pointer-events-none" : ""}`}
                        >
                            {isPending && (
                                <div className="absolute top-4 right-4 animate-spin text-neutral-400">
                                    <Loader2 className="w-4 h-4" />
                                </div>
                            )}

                            {/* ── Card header ── */}
                            <div className="p-5">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-xl bg-neutral-100 dark:bg-black border border-neutral-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                                        {t.logoUrl ? (
                                            <img src={t.logoUrl} alt={t.companyName} className="w-7 h-7 object-contain rounded" />
                                        ) : (
                                            <Building2 className="w-5 h-5 text-neutral-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-base leading-tight truncate">{t.companyName}</h3>
                                        {tenantAdmin?.email && (
                                            <div className="flex items-center gap-1 mt-0.5 text-neutral-400 text-[11px] truncate">
                                                <Mail className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{tenantAdmin.email}</span>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-neutral-400 mt-0.5">
                                            Joined {new Date(t.createdAt).toLocaleDateString("en-GB")}
                                        </div>
                                    </div>
                                </div>

                                {/* Plan + Status selectors */}
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    <select
                                        value={t.subscriptionStatus}
                                        onChange={(e) => handlePlanChange(t.id, e.target.value, t.planType)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider appearance-none cursor-pointer border-none outline-none ${STATUS_COLORS[t.subscriptionStatus] ?? STATUS_COLORS.INACTIVE}`}
                                    >
                                        {SUBSCRIPTION_STATUSES.map(s => (
                                            <option key={s} value={s} className="bg-white text-black">{s}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={t.planType}
                                        onChange={(e) => handlePlanChange(t.id, t.subscriptionStatus, e.target.value)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider appearance-none cursor-pointer border-none outline-none ${PLAN_COLORS[t.planType] ?? PLAN_COLORS.FREE}`}
                                    >
                                        {PLAN_TYPES.map(p => (
                                            <option key={p} value={p} className="bg-white text-black">{p}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Counters */}
                                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-neutral-100 dark:border-white/5 mb-4 text-center">
                                    <div>
                                        <div className="text-lg font-bold">{t._count.users}</div>
                                        <div className="text-[9px] uppercase tracking-wider text-neutral-400 flex items-center justify-center gap-0.5 mt-0.5">
                                            <Users className="w-2.5 h-2.5" /> Users
                                        </div>
                                    </div>
                                    <div className="border-x border-neutral-100 dark:border-white/5">
                                        <div className="text-lg font-bold">{t._count.clientPortals}</div>
                                        <div className="text-[9px] uppercase tracking-wider text-neutral-400 flex items-center justify-center gap-0.5 mt-0.5">
                                            <LayoutTemplate className="w-2.5 h-2.5" /> Portals
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold">{t._count.internalProjects}</div>
                                        <div className="text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5">Projects</div>
                                    </div>
                                </div>

                                {/* Module toggles */}
                                <div className="space-y-2 mb-4">
                                    <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Modules</h4>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {AVAILABLE_MODULES.map(module => {
                                            const isActive = t.activeModules?.includes(module);
                                            return (
                                                <button
                                                    key={module}
                                                    onClick={() => handleModuleToggle(t.id, module, isActive ?? false)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-all ${isActive
                                                        ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-black"
                                                        : "bg-white border-neutral-200 text-neutral-400 hover:border-neutral-400 dark:bg-transparent dark:border-white/10 dark:hover:border-white/30"
                                                    }`}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${isActive ? "border-white/30 dark:border-black/30" : "border-neutral-300 dark:border-white/20"}`}>
                                                        {isActive && <Check className="w-2 h-2" />}
                                                    </div>
                                                    <span className="text-[9px] font-bold tracking-wider leading-none">{module}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* ── Expandable: Peppol usage ── */}
                            <div className="border-t border-neutral-100 dark:border-white/5">
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                                    className="w-full flex items-center justify-between px-5 py-3 text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 uppercase tracking-widest font-bold transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Zap className="w-3 h-3" />
                                        Peppol usage this month
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-4 space-y-3 animate-in slide-in-from-top-1 fade-in duration-150">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3 text-center">
                                                <div className="text-xl font-bold">{t.peppolSentThisMonth}</div>
                                                <div className="text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5">Sent</div>
                                                {t.planType === "FREE" && (
                                                    <div className={`text-[9px] font-bold mt-1 ${t.peppolSentThisMonth >= 5 ? "text-red-500" : "text-neutral-400"}`}>
                                                        / 5 limit
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3 text-center">
                                                <div className="text-xl font-bold">{t.peppolReceivedThisMonth}</div>
                                                <div className="text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5">Received</div>
                                                {t.planType === "FREE" && (
                                                    <div className={`text-[9px] font-bold mt-1 ${t.peppolReceivedThisMonth >= 10 ? "text-amber-500" : "text-neutral-400"}`}>
                                                        / 10 soft cap
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleResetPeppol(t.id)}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-200 dark:border-white/10 text-[10px] font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:border-neutral-400 dark:hover:border-white/30 transition-all uppercase tracking-widest"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Reset counters
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── Danger zone ── */}
                            <div className="border-t border-neutral-100 dark:border-white/5 px-5 py-3">
                                {confirmDelete === t.id ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-red-500 font-bold flex-1">Delete all data?</span>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(null)}
                                            className="px-3 py-1.5 border border-neutral-200 dark:border-white/10 text-[10px] font-bold rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDelete(t.id)}
                                        className="flex items-center gap-1.5 text-[10px] text-neutral-400 hover:text-red-500 transition-colors font-bold uppercase tracking-widest"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Delete tenant
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
