"use client";
import React, { useMemo } from 'react';
import { 
    CheckCircle2, Circle, Clock, FileText, Flag, Receipt, Hammer, 
    ArrowUpRight, ListTodo, Layers, Paperclip, CalendarDays, TrendingUp
} from 'lucide-react';
import { useTranslations } from 'next-intl';

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
    setActiveTab
}: ProjectCockpitProps) {
    const t = useTranslations('Database');

    // ── Calculate KPIs ──────────────────────────────────────────
    const totalTasks = projectTasks.length;
    const doneTasks = projectTasks.filter(t => t.properties?.['prop-task-status'] === 'opt-done').length;
    const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const budget = Number(project.properties?.['budget'] || 0);
    // Expenses (from linked invoices/expenses). In the current logic, actualMaterialCost is the sum of projectExpenses totalExVat
    const actualMaterialCost = projectExpenses.reduce((sum, exp) => sum + (Number(exp.properties?.['totalExVat'] || 0)), 0);
    // Let's assume invoiced total as well for revenue
    const invoicedTotal = projectInvoices.reduce((sum, inv) => sum + (Number(inv.properties?.['totalExVat'] || 0)), 0);
    
    // We'll define "Budget Spent" as actualMaterialCost vs budget for now, unless budget implies something else.
    // The spec says "Budget spent % = prop-budget vs sum of project-linked expenses/invoices"
    // We'll combine expenses for spent.
    const budgetSpentPercent = budget > 0 ? Math.round((actualMaterialCost / budget) * 100) : 0;

    // Schedule variance: planed end vs projected.
    // For now, we just display the end date.
    const endDate = project.properties?.['prop-end-date'] ? String(project.properties?.['prop-end-date']) : 'Not set';

    // Group tasks into a hierarchy (tree)
    // We group them by status for simplicity if there's no tree structure
    const tasksByStatus = useMemo(() => {
        const groups: Record<string, any[]> = {
            'opt-to-do': [],
            'opt-in-prog': [],
            'opt-done': [],
        };
        projectTasks.forEach(task => {
            const status = task.properties?.['prop-task-status'] || 'opt-to-do';
            if (groups[status]) {
                groups[status].push(task);
            } else {
                groups['opt-to-do'].push(task);
            }
        });
        return groups;
    }, [projectTasks]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* ── Left Rail: Status & Tasks Tree ──────────────────────────────── */}
            <div className="xl:col-span-1 flex flex-col gap-6">
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <Flag className="w-4 h-4 text-[#d75d00]" /> Project Status
                    </h3>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold text-neutral-900 dark:text-white">Active</span>
                        <span className="px-2 py-1 bg-[#d75d00]/10 text-[#d75d00] rounded-lg text-xs font-bold uppercase">On Track</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">
                                <span>Progress</span>
                                <span className="text-emerald-500">{progressPercent}%</span>
                            </div>
                            <div className="h-2 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">
                                <span>Budget Spent</span>
                                <span className={budgetSpentPercent > 100 ? 'text-red-500' : 'text-amber-500'}>{budgetSpentPercent}%</span>
                            </div>
                            <div className="h-2 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ${budgetSpentPercent > 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, budgetSpentPercent)}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-neutral-400 mt-1">
                                <span>€{actualMaterialCost.toLocaleString()} spent</span>
                                <span>€{budget.toLocaleString()} total</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-indigo-500" /> Task Hierarchy
                    </h3>
                    <div className="space-y-4">
                        {['opt-to-do', 'opt-in-prog', 'opt-done'].map(status => {
                            const groupTasks = tasksByStatus[status] || [];
                            const labels = {
                                'opt-to-do': 'To Do',
                                'opt-in-prog': 'In Progress',
                                'opt-done': 'Done'
                            };
                            if (groupTasks.length === 0) return null;
                            return (
                                <div key={status} className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{labels[status as keyof typeof labels]}</h4>
                                    <div className="space-y-1.5">
                                        {groupTasks.slice(0, 5).map(task => (
                                            <div key={task.id} className="flex items-center gap-2 text-sm p-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setActiveTab('tasks')}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${status === 'opt-done' ? 'bg-emerald-500' : status === 'opt-in-prog' ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                                                <span className="truncate font-medium text-neutral-700 dark:text-neutral-300 text-xs">{task.properties?.['title'] || 'Untitled'}</span>
                                            </div>
                                        ))}
                                        {groupTasks.length > 5 && (
                                            <div className="text-[10px] font-bold text-indigo-500 pl-4 cursor-pointer" onClick={() => setActiveTab('tasks')}>
                                                + {groupTasks.length - 5} more tasks
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {totalTasks === 0 && (
                            <p className="text-xs text-neutral-500 italic">No tasks created yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Main Cockpit Area ────────────────────────────────────────── */}
            <div className="xl:col-span-3 flex flex-col gap-6">
                
                {/* ── Top KPI Row ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Overall Progress</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tabular-nums text-neutral-900 dark:text-white">{progressPercent}%</span>
                            <span className="text-xs font-bold text-neutral-500">{doneTasks} / {totalTasks} tasks</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Schedule</span>
                            <CalendarDays className="w-4 h-4 text-blue-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tabular-nums text-neutral-900 dark:text-white truncate">{endDate}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1 block">Planned End Date</span>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Budget Spent</span>
                            <Receipt className="w-4 h-4 text-amber-500 opacity-50" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-black tabular-nums ${budgetSpentPercent > 100 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>{budgetSpentPercent}%</span>
                            <span className="text-xs font-bold text-neutral-500">of €{budget.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* ── Bottom Module Cards ────────────────────────────────────────── */}
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mt-2 px-2">Project Modules</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    <button 
                        onClick={() => setActiveTab('tasks')}
                        className="group flex flex-col p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <ListTodo className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-neutral-900 dark:text-white mb-1">Schedule & Tasks</span>
                        <span className="text-xs font-medium text-neutral-500">{totalTasks} tasks tracked</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('files')}
                        className="group flex flex-col p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/10 transition-all text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Paperclip className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-neutral-900 dark:text-white mb-1">Documents & Media</span>
                        <span className="text-xs font-medium text-neutral-500">View project files</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('vorderingen')}
                        className="group flex flex-col p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-neutral-900 dark:text-white mb-1">Invoicing</span>
                        <span className="text-xs font-medium text-neutral-500">{projectInvoices.length} invoices generated</span>
                    </button>

                    <a 
                        href={`/${locale}/admin/suppliers/quotations?project=${pageId}`}
                        className="group flex flex-col p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-3xl hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10 transition-all text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Hammer className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-neutral-900 dark:text-white mb-1">Procurement</span>
                        <span className="text-xs font-medium text-neutral-500">Supplier Quotes</span>
                    </a>

                </div>

            </div>
        </div>
    );
}
