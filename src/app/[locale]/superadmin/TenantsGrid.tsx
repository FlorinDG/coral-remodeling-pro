"use client";

import { useTransition } from "react";
import { Building2, Users, LayoutTemplate, Loader2, Check } from "lucide-react";
import { updateTenantSubscription, toggleTenantModule } from "@/app/actions/superadmin";

const AVAILABLE_MODULES = ["CRM", "PROJECTS", "INVOICING", "CALENDAR", "DATABASES"];
const PLAN_TYPES = ["FREE", "PRO", "ENTERPRISE", "CUSTOM"];
const SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIAL", "INACTIVE", "CANCELLED"];

export default function TenantsGrid({ initialTenants }: { initialTenants: any[] }) {
    const [isPending, startTransition] = useTransition();

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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {initialTenants.map((t) => (
                <div key={t.id} className={`bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
                    {isPending && (
                        <div className="absolute top-4 right-4 animate-spin text-neutral-400">
                            <Loader2 className="w-4 h-4" />
                        </div>
                    )}

                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-black border border-neutral-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                            {t.logoUrl ? (
                                <img src={t.logoUrl} alt={t.companyName} className="w-8 h-8 object-contain" />
                            ) : (
                                <Building2 className="w-6 h-6 text-neutral-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg leading-tight truncate">{t.companyName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <select
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider appearance-none cursor-pointer border-none outline-none ${t.subscriptionStatus === 'ACTIVE'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                                            : t.subscriptionStatus === 'TRIAL'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                                        }`}
                                    value={t.subscriptionStatus}
                                    onChange={(e) => handlePlanChange(t.id, e.target.value, t.planType)}
                                >
                                    {SUBSCRIPTION_STATUSES.map(s => <option key={s} value={s} className="bg-white text-black">{s}</option>)}
                                </select>
                                <select
                                    className="text-xs text-neutral-500 font-bold bg-transparent border-none appearance-none cursor-pointer outline-none hover:text-black dark:hover:text-white transition-colors"
                                    value={t.planType}
                                    onChange={(e) => handlePlanChange(t.id, t.subscriptionStatus, e.target.value)}
                                >
                                    {PLAN_TYPES.map(p => <option key={p} value={p} className="bg-white text-black">{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-neutral-100 dark:border-white/5 mb-4">
                        <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-bold">{t._count.users}</span>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> Users</span>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center border-l border-neutral-100 dark:border-white/5">
                            <span className="text-xl font-bold">{t._count.clientPortals}</span>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1 flex items-center gap-1"><LayoutTemplate className="w-3 h-3" /> Portals</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Active Modules</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_MODULES.map(module => {
                                const isActive = t.activeModules?.includes(module);
                                return (
                                    <button
                                        key={module}
                                        onClick={() => handleModuleToggle(t.id, module, isActive)}
                                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${isActive
                                                ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-black'
                                                : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400 dark:bg-transparent dark:border-white/10 dark:hover:border-white/30'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${isActive ? 'border-white/30 dark:border-black/30' : 'border-neutral-300 dark:border-white/20'
                                            }`}>
                                            {isActive && <Check className="w-2.5 h-2.5" />}
                                        </div>
                                        <span className={`text-[10px] font-bold tracking-wider ${isActive ? '' : ''}`}>{module}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
