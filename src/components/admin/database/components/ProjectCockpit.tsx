"use client";
import React, { useMemo } from 'react';
import { 
    CheckCircle2, Circle, Clock, FileText, Flag, Receipt, Hammer, 
    ArrowUpRight, ListTodo, Layers, Paperclip, CalendarDays, TrendingUp, Users, FileCheck
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

interface ProjectCockpitProps {
    databaseId: string;
    pageId: string;
    project: any;
    projectTasks: any[];
    projectInvoices: any[];
    projectExpenses: any[];
    quotationFinancials: any;
    locale: string;
    setActiveTab: (tab: string) => void;
    actualLaborHours: number;
    actualLaborCost: number;
    linkedQuotations?: any[];
    supplierQuotations?: any[];
}

export default function ProjectCockpit({
    databaseId,
    pageId,
    project,
    projectTasks,
    projectInvoices,
    projectExpenses,
    quotationFinancials,
    locale,
    setActiveTab,
    actualLaborHours,
    actualLaborCost,
    linkedQuotations = [],
    supplierQuotations = []
}: ProjectCockpitProps) {
    const t = useTranslations('Database');

    // ── Calculate KPIs ──────────────────────────────────────────
    const totalTasks = projectTasks.length;
    const doneTasks = projectTasks.filter(t => t.properties?.['prop-task-status'] === 't-done').length;
    const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Financial Truth Calculations
    const budget = Number(project.properties?.['budget'] || 0);
    const contractRevenue = quotationFinancials.total || 0;
    
    // Revenue Ladder
    const invoicedTotal = projectInvoices.reduce((sum, inv) => sum + (Number(inv.properties?.['totalExVat'] || 0)), 0);
    const paidRevenue = 0; // TBD when payments DB exists

    // Cost Ladder
    const actualMaterialCost = projectExpenses.reduce((sum, exp) => sum + (Number(exp.properties?.['totalExVat'] || 0)), 0);
    const totalActualCost = actualMaterialCost + actualLaborCost;
    const committedCost = 0; // TBD when PO module exists
    
    // Margins
    const quotedMargin = contractRevenue - budget;
    const forecastCost = Math.max(budget, totalActualCost + committedCost);
    const forecastMargin = contractRevenue - forecastCost;
    const forecastMarginPercent = contractRevenue > 0 ? Math.round((forecastMargin / contractRevenue) * 100) : 0;
    const realizedMargin = invoicedTotal - totalActualCost; // Cash reference
    const budgetSpentPercent = budget > 0 ? Math.round((totalActualCost / budget) * 100) : 0;

    // Schedule variance
    const endDate = project.properties?.['prop-end-date'] ? String(project.properties?.['prop-end-date']) : 'Not set';

    const tasksByStatus = useMemo(() => {
        const groups: Record<string, any[]> = {
            't-todo': [],
            't-prog': [],
            't-done': [],
        };
        projectTasks.forEach(task => {
            const status = task.properties?.['prop-task-status'] || 't-todo';
            if (groups[status]) {
                groups[status].push(task);
            } else {
                groups['t-todo'].push(task);
            }
        });
        return groups;
    }, [projectTasks]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* ── Left Rail: Context & Documents ──────────────────────────────── */}
            <div className="xl:col-span-1 flex flex-col gap-6">
                
                {/* 1. Status & Tasks */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-indigo-500" /> Tasks ({totalTasks})
                    </h3>
                    <div className="space-y-4">
                        {['t-todo', 't-prog', 't-done'].map(status => {
                            const groupTasks = tasksByStatus[status] || [];
                            const labels = {
                                't-todo': 'To Do',
                                't-prog': 'In Progress',
                                't-done': 'Done'
                            };
                            if (groupTasks.length === 0) return null;
                            return (
                                <div key={status} className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex justify-between">
                                        <span>{labels[status as keyof typeof labels]}</span>
                                        <span>{groupTasks.length}</span>
                                    </h4>
                                    <div className="space-y-1.5">
                                        {groupTasks.slice(0, 3).map(task => (
                                            <div key={task.id} className="flex items-center gap-2 text-sm p-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setActiveTab('tasks')}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${status === 't-done' ? 'bg-emerald-500' : status === 't-prog' ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                                                <span className="truncate font-medium text-neutral-700 dark:text-neutral-300 text-xs">{task.properties?.['title'] || 'Untitled'}</span>
                                            </div>
                                        ))}
                                        {groupTasks.length > 3 && (
                                            <div className="text-[10px] font-bold text-indigo-500 pl-4 cursor-pointer" onClick={() => setActiveTab('tasks')}>
                                                + {groupTasks.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {totalTasks === 0 && (
                            <p className="text-[11px] text-neutral-400 italic">No tasks created yet.</p>
                        )}
                    </div>
                </div>

                {/* 2. Crew & Hours */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" /> Crew & Hours
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-500 text-[11px] font-bold uppercase tracking-wider">Quoted Hours</span>
                            <span className="font-bold font-mono">{quotationFinancials.labourHours}h</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-500 text-[11px] font-bold uppercase tracking-wider">Actual Hours</span>
                            <span className={`font-bold font-mono ${actualLaborHours > quotationFinancials.labourHours ? 'text-red-500' : 'text-emerald-500'}`}>{actualLaborHours}h</span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden mt-1">
                            <div 
                                className={`h-full transition-all duration-1000 ${actualLaborHours > quotationFinancials.labourHours ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${Math.min(100, quotationFinancials.labourHours > 0 ? (actualLaborHours / quotationFinancials.labourHours) * 100 : 0)}%` }} 
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Documents Rollup */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-amber-500" /> Documents
                    </h3>
                    <div className="space-y-4">
                        {linkedQuotations.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Quotes ({linkedQuotations.length})</h4>
                                <div className="space-y-1.5">
                                    {linkedQuotations.map(q => (
                                        <Link key={q.id} href={`/admin/quotations/${q.id}`} className="flex justify-between items-center p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 text-xs transition-colors">
                                            <span className="truncate font-medium text-indigo-600 dark:text-indigo-400">{q.properties?.['title'] || 'Quote'}</span>
                                            <ArrowUpRight className="w-3 h-3 text-neutral-400" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                        {projectInvoices.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2 mt-2">Sales Invoices ({projectInvoices.length})</h4>
                                <div className="space-y-1.5">
                                    {projectInvoices.map(inv => (
                                        <Link key={inv.id} href={`/admin/invoices/${inv.id}`} className="flex justify-between items-center p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 text-xs transition-colors">
                                            <span className="truncate font-medium text-emerald-600 dark:text-emerald-400">{inv.properties?.['title'] || 'Invoice'}</span>
                                            <span className="font-mono text-[10px] font-bold">€{Number(inv.properties?.['totalExVat'] || 0).toLocaleString()}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ── Main Cockpit Area ────────────────────────────────────────── */}
            <div className="xl:col-span-3 flex flex-col gap-6">
                
                {/* ── Hero Row ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Live Margin</span>
                            <TrendingUp className="w-4 h-4 text-indigo-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black tabular-nums text-neutral-900 dark:text-white">€{forecastMargin.toLocaleString()}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 block ${forecastMarginPercent >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {forecastMarginPercent}% FORECAST
                        </span>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Progress</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black tabular-nums text-neutral-900 dark:text-white">{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Cost vs Budget</span>
                            <Receipt className="w-4 h-4 text-amber-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-black tabular-nums ${budgetSpentPercent > 100 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>{budgetSpentPercent}%</span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden mt-2">
                            <div className={`h-full transition-all duration-1000 ${budgetSpentPercent > 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, budgetSpentPercent)}%` }} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Timeline</span>
                            <CalendarDays className="w-4 h-4 text-blue-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black tabular-nums text-neutral-900 dark:text-white truncate">{endDate}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-2 block">Planned End</span>
                    </div>
                </div>

                {/* ── Ladders (Revenue vs Cost) ──────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Revenue Ladder */}
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Revenue Pipeline
                        </h3>
                        
                        <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">1. Quoted / Contract</span>
                            <span className="font-mono font-black text-sm">€{contractRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5 opacity-50">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">2. Ordered (PO In)</span>
                            <span className="font-mono font-black text-sm text-neutral-400">TBD</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">3. Invoiced</span>
                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">€{invoicedTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 opacity-50">4. Paid</span>
                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 opacity-50">TBD</span>
                        </div>
                    </div>

                    {/* Cost Ladder */}
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                            <Receipt className="w-4 h-4" /> Cost Tracking
                        </h3>
                        
                        <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">1. Budget</span>
                            <span className="font-mono font-black text-sm">€{budget.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5 opacity-50">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">2. Committed (PO Out)</span>
                            <span className="font-mono font-black text-sm text-neutral-400">€0</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500">3. Actual (Inv + Labor)</span>
                            <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">€{totalActualCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500 opacity-50">4. Paid</span>
                            <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 opacity-50">TBD</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
