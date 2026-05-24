"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useDatabaseStore } from '../store';
import { useFileManagerStore } from '@/components/admin/file-manager/store';
import { useTenant } from '@/context/TenantContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import dynamic from 'next/dynamic';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import {
    CheckCircle2, Circle, Clock, AlertTriangle, Pause, XCircle,
    CalendarDays, MapPin, TrendingUp, ListTodo, Plus,
    FolderKanban, Layers, PenLine, FileText, ArrowUpRight, Target, ClipboardCheck,
    Hammer, Calculator, Paperclip, Calendar, ChevronDown, Flag,
    BarChart3, Receipt, ExternalLink
} from 'lucide-react';
import { Block, PropertyValue } from '../types';

const JournalCard = dynamic(() => import('./JournalCard'), { ssr: false });
const FileManager = dynamic(() => import('@/components/admin/file-manager/FileManager'), { ssr: false });
const LinkedRecords = dynamic(() => import('./LinkedRecords'), { ssr: false });
const PageFinancialAnalysis = dynamic(() => import('./PageFinancialAnalysis'), { ssr: false });

// ── Status configuration ──────────────────────────────────────────────
const EXEC_STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
    'opt-to-do':    { label: 'To Do',       color: 'text-neutral-500', icon: <Circle className="w-4 h-4" />,          bg: 'bg-neutral-500/10' },
    'opt-in-prog':  { label: 'In Progress', color: 'text-blue-500',    icon: <Clock className="w-4 h-4" />,           bg: 'bg-blue-500/10' },
    'opt-done':     { label: 'Done',        color: 'text-emerald-500', icon: <CheckCircle2 className="w-4 h-4" />,    bg: 'bg-emerald-500/10' },
    'opt-hold':     { label: 'On Hold',     color: 'text-amber-500',   icon: <Pause className="w-4 h-4" />,           bg: 'bg-amber-500/10' },
    'opt-dropped':  { label: 'Dropped',     color: 'text-neutral-400', icon: <XCircle className="w-4 h-4" />,         bg: 'bg-neutral-400/10' },
    'opt-late':     { label: 'Late',        color: 'text-red-500',     icon: <AlertTriangle className="w-4 h-4" />,   bg: 'bg-red-500/10' },
    'opt-problems': { label: 'Problems',    color: 'text-orange-500',  icon: <AlertTriangle className="w-4 h-4" />,   bg: 'bg-orange-500/10' },
};

const FINANCIAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
    'opt-quote':   { label: 'Quotation',       color: 'text-neutral-500' },
    'opt-budget':  { label: 'Budgeted',        color: 'text-amber-500' },
    'opt-invo':    { label: 'Invoiced',        color: 'text-blue-500' },
    'opt-partial': { label: 'Partially Paid',  color: 'text-indigo-500' },
    'opt-paid':    { label: 'Paid',            color: 'text-emerald-500' },
};

const TASK_STATUS_MAP: Record<string, { label: string; color: string; dotColor: string }> = {
    't-todo': { label: 'To Do', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300', dotColor: 'bg-neutral-400' },
    't-prog': { label: 'Busy',  color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',          dotColor: 'bg-blue-500' },
    't-done': { label: 'Done',  color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
};

const TASK_PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
    'opt-p1': { label: '🔴 Urgent', color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20'     },
    'opt-p2': { label: '🟠 High',   color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20'},
    'opt-p3': { label: '🟡 Medium', color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
    'opt-p4': { label: '⚪ Low',    color: 'text-neutral-500', bg: 'bg-neutral-50 dark:bg-neutral-800' },
};

const BILLING_RULE_OPTIONS = [
    { id: 'opt-fixed',    label: 'Vaste prijs (Fixed Fee)' },
    { id: 'opt-progress', label: 'Vorderingenstaten (Progress-based)' },
    { id: 'opt-hourly',   label: 'In Regie (Hourly)' },
];

// ── Inline Custom Dropdown ──────────────────────────────────────────────
function CustomDropdown({ value, options, onChange, className = '' }: {
    value: string;
    options: { id: string; label: string }[];
    onChange: (val: string) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.id === value) || options[0];

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-2 text-xs font-bold bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-neutral-800 dark:text-neutral-200 hover:border-neutral-400 dark:hover:border-white/20 transition-colors outline-none"
            >
                <span className="truncate">{selected?.label}</span>
                <ChevronDown className={`w-3 h-3 text-neutral-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => { onChange(opt.id); setOpen(false); }}
                            className={`w-full text-left text-xs font-semibold px-3 py-2 transition-colors ${
                                opt.id === value
                                    ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white'
                                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface ProjectDetailViewProps {
    databaseId: string;     // resolved DB ID
    pageId: string;
    locale: string;
}

export default function ProjectDetailView({ databaseId, pageId, locale }: ProjectDetailViewProps) {
    const { resolveDbId } = useTenant();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'journal' | 'files' | 'vorderingen'>('overview');
    const [taskFilter, setTaskFilter] = useState<string | null>(null);
    const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const page = useDatabaseStore(state => state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const updatePageDriveId = useDatabaseStore(state => state.updatePageDriveId);
    const createPage = useDatabaseStore(state => state.createPage);
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const allDatabases = useDatabaseStore(state => state.databases);

    // Resolve Tasks DB
    const tasksDbId = resolveDbId('db-tasks');
    const tasksDb = allDatabases.find(d => d.id === tasksDbId);

    // Get tasks linked to this project
    const projectTasks = useMemo(() => {
        if (!tasksDb) return [];
        return tasksDb.pages.filter(t => {
            const projectRelation = t.properties['prop-task-project'];
            if (Array.isArray(projectRelation)) return projectRelation.includes(pageId);
            return projectRelation === pageId;
        });
    }, [tasksDb, pageId]);

    // Task statistics
    const taskStats = useMemo(() => {
        const total = projectTasks.length;
        const done = projectTasks.filter(t => t.properties['prop-task-status'] === 't-done').length;
        const busy = projectTasks.filter(t => t.properties['prop-task-status'] === 't-prog').length;
        const todo = total - done - busy;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, busy, todo, progress };
    }, [projectTasks]);

    if (!database || !page) return null;

    const initializeContextFolder = useFileManagerStore(state => state.initializeContextFolder);
    const boundDriveId = page.driveFolderId || (page.properties['driveFolderId'] as string) || undefined;

    React.useEffect(() => {
        const createDriveFolder = async () => {
            if (!boundDriveId && page.properties['title']) {
                const folderName = String(page.properties['title'] || page.properties['name'] || `Project ${pageId}`);
                const driveId = await initializeContextFolder(folderName, 'project', page.id);
                if (driveId) {
                    updatePageDriveId(databaseId, page.id, driveId);
                }
            }
        };
        createDriveFolder();
    }, [page.id, boundDriveId, databaseId, initializeContextFolder, updatePageDriveId]);

    // ── Extract project data ──────────────────────────────────────────────
    const execStatus = String(page.properties['prop-execution-status'] || '');
    const finStatus = String(page.properties['prop-financial-status'] || '');
    const budget = Number(page.properties['prop-budget']) || 0;
    const location = String(page.properties['prop-location'] || '');
    const plannedStart = String(page.properties['prop-start-date'] || '');
    const plannedEnd = String(page.properties['prop-end-date'] || '');
    const actualStart = String(page.properties['prop-actual-start'] || '');
    const actualEnd = String(page.properties['prop-actual-end'] || '');

    // Project-specific billing rule
    const billingRule = String(page.properties['prop-billing-rule'] || 'opt-fixed');

    // ── Quotation Data Resolution ─────────────────────────────────────────
    const quotationsDbId = resolveDbId('db-quotations');
    const linkedQuoteIds = useMemo(() => {
        const raw = page.properties['prop-project-quote'];
        if (Array.isArray(raw)) return raw as string[];
        if (typeof raw === 'string' && raw) return [raw];
        return [];
    }, [page.properties]);

    const linkedQuotation = useMemo(() => {
        if (linkedQuoteIds.length === 0) return null;
        // Search across all quotation databases (tenant-prefixed)
        return allDatabases
            .filter(d => d.id === quotationsDbId || d.id.startsWith('db-quotations'))
            .flatMap(d => d.pages)
            .find(p => linkedQuoteIds.includes(p.id)) || null;
    }, [allDatabases, linkedQuoteIds, quotationsDbId]);

    const quotationFinancials = useMemo(() => {
        if (!linkedQuotation) return { total: 0, materialCost: 0, labourHours: 0, avgLabourRate: 0, lineCount: 0 };

        let total = 0;
        let materialCost = 0;
        let labourHours = 0;
        let labourCostWeighted = 0;
        let lineCount = 0;

        const traverse = (blocks: Block[]) => {
            blocks.forEach(block => {
                if ((block.type === 'line' || block.type === 'post') && !block.isOptional) {
                    const qty = block.quantity || 1;
                    const verkoop = block.verkoopPrice || 0;
                    const bruto = block.brutoPrice || 0;
                    total += qty * verkoop;
                    materialCost += qty * bruto;
                    lineCount++;

                    // Infer labour from bestek-linked posts
                    if (block.labourHours) {
                        const lh = qty * block.labourHours;
                        const lr = block.labourRate || 35; // Default general rate
                        labourHours += lh;
                        labourCostWeighted += lh * lr;
                    }
                }
                if (block.children) traverse(block.children);
            });
        };
        traverse(linkedQuotation.blocks || []);

        const avgLabourRate = labourHours > 0 ? Math.round((labourCostWeighted / labourHours) * 100) / 100 : 35;

        return {
            total: Math.round(total * 100) / 100,
            materialCost: Math.round(materialCost * 100) / 100,
            labourHours: Math.round(labourHours * 100) / 100,
            avgLabourRate,
            lineCount,
        };
    }, [linkedQuotation]);

    // ── Actual Labour from Clock Entries ──────────────────────────────────
    const { entries: clockEntries } = useClockEntries();
    const { shifts: allShifts } = useScheduledShifts();

    const projectShifts = useMemo(() => {
        return allShifts.filter(s => s.projectId === pageId || s.project_id === pageId);
    }, [allShifts, pageId]);

    const projectClockEntries = useMemo(() => {
        const shiftIds = new Set(projectShifts.map(s => s.id));
        return clockEntries.filter(e => e.shiftId && shiftIds.has(e.shiftId));
    }, [clockEntries, projectShifts]);

    const actualLaborHours = useMemo(() => {
        let total = 0;
        projectClockEntries.forEach(entry => {
            if (entry.clockOutTime) {
                const start = new Date(entry.clockInTime).getTime();
                const end = new Date(entry.clockOutTime).getTime();
                let hours = (end - start) / (1000 * 60 * 60);
                if (!entry.noBreak && hours > 4) {
                    hours = Math.max(0, hours - 0.5);
                }
                total += hours;
            }
        });
        return Math.round(total * 100) / 100;
    }, [projectClockEntries]);

    const actualLaborCost = useMemo(() => {
        return actualLaborHours * quotationFinancials.avgLabourRate;
    }, [actualLaborHours, quotationFinancials.avgLabourRate]);

    const totalActualCost = actualLaborCost;

    // ── Vorderingenstaten data (needed for financial computations below) ──
    const vorderingenstaten = useMemo(() => {
        if (!page?.properties) return [];
        return (page.properties['vorderingenstaten'] as any[]) || [];
    }, [page?.properties]);

    // ── Vorderingenstaten totals ──────────────────────────────────────────
    const invoicedTotal = useMemo(() => {
        return vorderingenstaten
            .filter((vs: any) => vs.status === 'invoiced')
            .reduce((sum: number, vs: any) => sum + (Number(vs.totalExVat) || 0), 0);
    }, [vorderingenstaten]);

    const draftTotal = useMemo(() => {
        return vorderingenstaten
            .filter((vs: any) => vs.status === 'draft')
            .reduce((sum: number, vs: any) => sum + (Number(vs.totalExVat) || 0), 0);
    }, [vorderingenstaten]);

    // Effective budget: use prop-budget, or fall back to quotation total
    const effectiveBudget = budget > 0 ? budget : quotationFinancials.total;
    const budgetIsFromQuote = budget === 0 && quotationFinancials.total > 0;
    const remainingToInvoice = quotationFinancials.total > 0
        ? quotationFinancials.total - invoicedTotal - draftTotal
        : 0;
    const invoicedPercent = quotationFinancials.total > 0
        ? Math.round(((invoicedTotal + draftTotal) / quotationFinancials.total) * 100)
        : 0;

    const statusInfo = EXEC_STATUS_MAP[execStatus] || EXEC_STATUS_MAP['opt-to-do'];
    const finInfo = FINANCIAL_STATUS_MAP[finStatus] || FINANCIAL_STATUS_MAP['opt-quote'];

    // Timeline progress calculation
    const timelineProgress = useMemo(() => {
        if (!plannedStart || !plannedEnd) return null;
        const start = new Date(plannedStart).getTime();
        const end = new Date(plannedEnd).getTime();
        const now = Date.now();
        if (isNaN(start) || isNaN(end) || end <= start) return null;
        const total = end - start;
        const elapsed = now - start;
        return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    }, [plannedStart, plannedEnd]);

    // Days remaining
    const daysRemaining = useMemo(() => {
        if (!plannedEnd) return null;
        const end = new Date(plannedEnd).getTime();
        if (isNaN(end)) return null;
        const diff = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
        return diff;
    }, [plannedEnd]);

    // Add a new task
    const handleAddTask = () => {
        if (!tasksDb) return;
        const title = String(page.properties['title'] || page.properties['name'] || 'Project');
        const newPage = createPage(tasksDbId, {
            title: `New task — ${title}`,
            'prop-task-project': [pageId],
            'prop-task-status': 't-todo',
            'prop-task-type': 'ty-task',
            'prop-task-priority': 'opt-p4',
        });
        // Auto-expand the new task for editing
        if (newPage) {
            setExpandedTaskId(newPage.id);
            setEditingTaskId(newPage.id);
            setEditingTitle(`New task — ${title}`);
        }
    };

    // Toggle task status
    const handleToggleTask = (taskId: string) => {
        if (!tasksDb) return;
        const task = tasksDb.pages.find(t => t.id === taskId);
        if (!task) return;
        const current = String(task.properties['prop-task-status'] || 't-todo');
        const next = current === 't-done' ? 't-todo' : current === 't-prog' ? 't-done' : 't-prog';
        updatePageProperty(tasksDbId, taskId, 'prop-task-status', next);
    };

    // Update task title on blur/enter
    const handleSaveTaskTitle = (taskId: string) => {
        if (editingTitle.trim()) {
            updatePageProperty(tasksDbId, taskId, 'title', editingTitle.trim());
        }
        setEditingTaskId(null);
    };

    // Update any task property
    const handleUpdateTaskProp = (taskId: string, key: string, val: PropertyValue) => {
        updatePageProperty(tasksDbId, taskId, key, val);
    };

    // Format a due date briefly
    const formatShortDate = (d: string) => {
        if (!d) return '';
        try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
        catch { return d; }
    };

    // Filtered tasks
    const filteredTasks = taskFilter
        ? projectTasks.filter(t => t.properties['prop-task-status'] === taskFilter)
        : projectTasks;

    const formatDate = (d: string) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
        catch { return d; }
    };


    const handleCreateInvoiceFromVS = (vs: any) => {
        const invoiceDbId = resolveDbId('db-invoices');
        const today = new Date().toISOString().split('T')[0];

        // 1. Resolve client
        const rawClient = page.properties['client'] || page.properties['prop-client'] || [];
        const clientId = Array.isArray(rawClient) ? (rawClient[0] || '') : (rawClient as string) || '';

        // 2. Create the invoice
        const newInvoice = createPage(invoiceDbId, {
            client: clientId ? [clientId] : [],
            betreft: `Vorderingstaat ${vs.number} — ${page.properties['title'] || page.properties['name'] || 'Project'}`,
            status: 'opt-draft',
            invoiceDate: today,
            deliveryDate: today,
            totalExVat: vs.totalExVat,
            totalVat: vs.vatAmount,
            totalIncVat: vs.totalIncVat,
        });

        if (!newInvoice) {
            toast.error('Factuur aanmaken mislukt.');
            return;
        }

        // 3. Clone line items as blocks
        const invoiceBlocks: Block[] = vs.items.map((item: any) => ({
            id: crypto.randomUUID(),
            type: 'line',
            content: `${item.content} (Cumulatieve vordering: ${item.previousProgress + item.currentProgress}%)`,
            quantity: 1,
            unit: 'st',
            verkoopPrice: item.amount,
            brutoPrice: item.amount,
            margePercent: 0,
            vatRate: '21',
        }));

        updatePageBlocks(invoiceDbId, newInvoice.id, invoiceBlocks);

        // 4. Update the vorderingenstaten array in this project
        const updatedStates = vorderingenstaten.map((state: any) => {
            if (state.id === vs.id) {
                return {
                    ...state,
                    status: 'invoiced',
                    invoiceId: newInvoice.id,
                    invoicedAt: new Date().toISOString()
                };
            }
            return state;
        });

        updatePageProperty(databaseId, pageId, 'vorderingenstaten', updatedStates);

        toast.success(`Factuur aangemaakt voor Vorderingstaat ${vs.number}!`);
        router.push(`/${locale}/admin/invoices/${newInvoice.id}`);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-[#0a0a0a]">
            <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 flex flex-col gap-6">

                {/* ── Hero Status Bar ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Execution Status */}
                    <div className={`rounded-2xl border border-neutral-200 dark:border-white/10 p-4 ${statusInfo.bg} flex items-center gap-3 shadow-sm`}>
                        <div className={`${statusInfo.color}`}>{statusInfo.icon}</div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Status</p>
                            <p className={`text-sm font-bold ${statusInfo.color}`}>{statusInfo.label}</p>
                        </div>
                    </div>

                    {/* Task Progress */}
                    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 p-4 bg-white dark:bg-neutral-900 flex flex-col gap-2 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Tasks</p>
                            <span className="text-xs font-black text-neutral-900 dark:text-white">{taskStats.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${taskStats.progress}%`,
                                    background: taskStats.progress === 100
                                        ? 'linear-gradient(90deg, #10b981, #059669)'
                                        : 'linear-gradient(90deg, var(--brand-color, #d35400), color-mix(in srgb, var(--brand-color, #d35400) 70%, #f59e0b))'
                                }}
                            />
                        </div>
                        <p className="text-[10px] text-neutral-400">{taskStats.done}/{taskStats.total} completed</p>
                    </div>

                    {/* Timeline */}
                    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 p-4 bg-white dark:bg-neutral-900 flex flex-col gap-1 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Timeline</p>
                        {daysRemaining !== null ? (
                            <>
                                <p className={`text-lg font-black ${daysRemaining < 0 ? 'text-red-500' : daysRemaining < 7 ? 'text-amber-500' : 'text-neutral-900 dark:text-white'}`}>
                                    {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`}
                                </p>
                                {timelineProgress !== null && (
                                    <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mt-0.5">
                                        <div
                                            className={`h-full rounded-full transition-all ${timelineProgress > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(timelineProgress, 100)}%` }}
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-neutral-400 italic">No dates set</p>
                        )}
                    </div>

                    {/* Budget */}
                    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 p-4 bg-white dark:bg-neutral-900 flex flex-col gap-1 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Budget</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${finInfo.color} bg-neutral-100 dark:bg-white/5`}>
                                {finInfo.label}
                            </span>
                        </div>
                        <p className="text-lg font-black text-neutral-900 dark:text-white tabular-nums">
                            {effectiveBudget > 0 ? `€${effectiveBudget.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}` : '—'}
                        </p>
                        {budgetIsFromQuote && (
                            <p className="text-[9px] font-semibold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                                <Receipt className="w-3 h-3" /> from quotation
                            </p>
                        )}
                        {invoicedPercent > 0 && (
                            <div className="mt-1">
                                <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700 ease-out bg-emerald-500"
                                        style={{ width: `${Math.min(invoicedPercent, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-neutral-400 mt-0.5">{invoicedPercent}% invoiced</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Tab Bar ─────────────────────────────────────────────── */}
                <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-white/10">
                    {[
                        { id: 'overview' as const, label: 'Overview', icon: <FolderKanban className="w-3.5 h-3.5" /> },
                        { id: 'vorderingen' as const, label: 'Vorderingenstaten', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
                        { id: 'journal'  as const, label: 'Journal',  icon: <PenLine className="w-3.5 h-3.5" /> },
                        { id: 'files'    as const, label: 'Files',    icon: <FileText className="w-3.5 h-3.5" /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                activeTab === tab.id
                                    ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ─────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        {/* Task Board — spans 2 columns */}
                        <div className="xl:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <ListTodo className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                                    Tasks
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-500 ml-1">{taskStats.total}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Filter pills */}
                                    {Object.entries(TASK_STATUS_MAP).map(([key, val]) => {
                                        const count = projectTasks.filter(t => t.properties['prop-task-status'] === key).length;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setTaskFilter(taskFilter === key ? null : key)}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                    taskFilter === key
                                                        ? val.color + ' ring-1 ring-neutral-300 dark:ring-white/20'
                                                        : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                                                }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${val.dotColor}`} />
                                                {val.label}
                                                <span className="text-neutral-400">{count}</span>
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={handleAddTask}
                                        className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                                        style={{ color: 'var(--brand-color, #d35400)' }}
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>
                            </div>

                            {/* Task List */}
                            <div className="divide-y divide-neutral-100 dark:divide-white/5 max-h-[500px] overflow-y-auto">
                                {filteredTasks.length > 0 ? filteredTasks.map(task => {
                                    const status = String(task.properties['prop-task-status'] || 't-todo');
                                    const statusInfo = TASK_STATUS_MAP[status] || TASK_STATUS_MAP['t-todo'];
                                    const isDone = status === 't-done';
                                    const taskTitle = String(task.properties['title'] || 'Untitled');
                                    const taskPriority = String(task.properties['prop-task-priority'] || 'opt-p4');
                                    const taskDue = String(task.properties['prop-task-due'] || '');
                                    const isExpanded = expandedTaskId === task.id;
                                    const isEditing = editingTaskId === task.id;
                                    const priorityInfo = TASK_PRIORITY_MAP[taskPriority] || TASK_PRIORITY_MAP['opt-p4'];

                                    return (
                                        <div key={task.id} className="group">
                                            {/* ── Main Row ── */}
                                            <div
                                                className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                                                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                            >
                                                {/* Status toggle */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id); }}
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                        isDone
                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                            : status === 't-prog'
                                                            ? 'border-blue-500 text-blue-500'
                                                            : 'border-neutral-300 dark:border-neutral-600 text-transparent hover:border-neutral-400'
                                                    }`}
                                                >
                                                    {isDone && <CheckCircle2 className="w-3 h-3" />}
                                                    {status === 't-prog' && <Clock className="w-3 h-3" />}
                                                </button>

                                                {/* Task title — editable on click */}
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        value={editingTitle}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => setEditingTitle(e.target.value)}
                                                        onBlur={() => handleSaveTaskTitle(task.id)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTaskTitle(task.id); if (e.key === 'Escape') setEditingTaskId(null); }}
                                                        className="flex-1 text-sm font-medium bg-transparent border-b-2 border-blue-500 outline-none text-neutral-800 dark:text-neutral-200 py-0"
                                                    />
                                                ) : (
                                                    <span
                                                        className={`flex-1 text-sm font-medium truncate cursor-text hover:underline decoration-dotted underline-offset-2 ${isDone ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'}`}
                                                        onClick={(e) => { e.stopPropagation(); setEditingTaskId(task.id); setEditingTitle(taskTitle); }}
                                                        title="Click to edit title"
                                                    >
                                                        {taskTitle}
                                                    </span>
                                                )}

                                                {/* Quick badges */}
                                                {taskDue && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/5 text-neutral-500 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatShortDate(taskDue)}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>

                                                {/* Expand chevron */}
                                                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />

                                                {/* Link to full detail */}
                                                <a
                                                    href={`/${locale}/admin/database/${tasksDbId}/${task.id}`}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/5"
                                                    title="Open task detail"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
                                                </a>
                                            </div>

                                            {/* ── Action Bar (expanded) ── */}
                                            {isExpanded && (
                                                <div className="px-5 pb-3 pt-0 ml-8 flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    {/* Status select */}
                                                    <CustomDropdown
                                                        value={status}
                                                        options={Object.entries(TASK_STATUS_MAP).map(([id, v]) => ({ id, label: v.label }))}
                                                        onChange={(v) => handleUpdateTaskProp(task.id, 'prop-task-status', v)}
                                                        className="w-28"
                                                    />

                                                    {/* Priority select */}
                                                    <CustomDropdown
                                                        value={taskPriority}
                                                        options={Object.entries(TASK_PRIORITY_MAP).map(([id, v]) => ({ id, label: v.label }))}
                                                        onChange={(v) => handleUpdateTaskProp(task.id, 'prop-task-priority', v)}
                                                        className="w-32"
                                                    />

                                                    {/* Due date */}
                                                    <div className="relative">
                                                        <input
                                                            type="date"
                                                            value={taskDue}
                                                            onChange={(e) => handleUpdateTaskProp(task.id, 'prop-task-due', e.target.value)}
                                                            className="text-[11px] font-semibold bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-neutral-700 dark:text-neutral-300 outline-none focus:border-blue-500 transition-colors w-32"
                                                        />
                                                    </div>

                                                    {/* Attachments icon */}
                                                    <a
                                                        href={`/${locale}/admin/database/${tasksDbId}/${task.id}`}
                                                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                                                        title="Open task to add attachments"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5 text-neutral-400" />
                                                    </a>

                                                    {/* Flag toggle */}
                                                    <button
                                                        onClick={() => handleUpdateTaskProp(task.id, 'prop-task-flagged', !task.properties['prop-task-flagged'])}
                                                        className={`p-1.5 rounded-lg border transition-colors ${
                                                            task.properties['prop-task-flagged']
                                                                ? 'border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 text-red-500'
                                                                : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400'
                                                        }`}
                                                        title={task.properties['prop-task-flagged'] ? 'Remove flag' : 'Flag task'}
                                                    >
                                                        <Flag className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                                        <Target className="w-8 h-8 opacity-20 mb-3" />
                                        <p className="text-xs font-medium">
                                            {taskFilter ? 'No tasks with this status' : 'No tasks yet'}
                                        </p>
                                        <button
                                            onClick={handleAddTask}
                                            className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                                            style={{ color: 'var(--brand-color, #d35400)' }}
                                        >
                                            Create first task
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right sidebar — Project Info */}
                        <div className="flex flex-col gap-4">
                            {/* Date Range Card */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <CalendarDays className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} /> Schedule
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Planned Start</p>
                                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{formatDate(plannedStart)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Planned End</p>
                                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{formatDate(plannedEnd)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Actual Start</p>
                                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{formatDate(actualStart)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Actual End</p>
                                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{formatDate(actualEnd)}</p>
                                        </div>
                                    </div>

                                    {location && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-white/5">
                                            <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                            <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate">{location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Project Profitability Card */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center justify-between font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-emerald-500" /> Project Profitability
                                    </div>
                                    {linkedQuotation && (
                                        <a
                                            href={`/${locale}/admin/quotations`}
                                            className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-400 flex items-center gap-1 normal-case tracking-normal transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {String(linkedQuotation.properties?.['title'] || 'View Quote')}
                                        </a>
                                    )}
                                </div>
                                <div className="p-4 space-y-4">
                                    {/* Billing Rule */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Billing Rule</label>
                                        <CustomDropdown
                                            value={billingRule}
                                            options={BILLING_RULE_OPTIONS}
                                            onChange={(v) => updatePageProperty(databaseId, pageId, 'prop-billing-rule', v)}
                                        />
                                    </div>

                                    {linkedQuotation ? (
                                        <>
                                            {/* From Quotation */}
                                            <div className="pt-3 border-t border-neutral-100 dark:border-white/5">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-2 flex items-center gap-1">
                                                    <Receipt className="w-3 h-3" /> From Quotation
                                                </p>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
                                                        <span>Quote Total (ex. VAT)</span>
                                                        <span className="font-mono text-neutral-800 dark:text-neutral-200">€{quotationFinancials.total.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {quotationFinancials.materialCost > 0 && (
                                                        <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
                                                            <span>Material Cost</span>
                                                            <span className="font-mono">€{quotationFinancials.materialCost.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                    {quotationFinancials.labourHours > 0 && (
                                                        <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
                                                            <span>Labour (est.)</span>
                                                            <span className="font-mono">{quotationFinancials.labourHours}h × €{quotationFinancials.avgLabourRate}/h</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actual Costs */}
                                            <div className="pt-3 border-t border-neutral-100 dark:border-white/5">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400 mb-2 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Actual Costs
                                                </p>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
                                                        <span>Labour (clocked)</span>
                                                        <span className="font-mono">{actualLaborHours}h — €{actualLaborCost.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs font-black text-neutral-800 dark:text-neutral-200 pt-1 border-t border-dashed border-neutral-200 dark:border-neutral-800">
                                                        <span>Total Costs</span>
                                                        <span className="font-mono text-amber-500">€{totalActualCost.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Margin Analysis */}
                                            {quotationFinancials.total > 0 && (
                                                <div className="pt-3 border-t border-neutral-100 dark:border-white/5">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> Margin Analysis
                                                    </p>
                                                    {(() => {
                                                        const margin = quotationFinancials.total - totalActualCost;
                                                        const marginPercent = Math.round((margin / quotationFinancials.total) * 100);
                                                        const isHealthy = margin >= 0;
                                                        const usedPercent = Math.min(100, Math.round((totalActualCost / quotationFinancials.total) * 100));
                                                        return (
                                                            <div className="space-y-2">
                                                                <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden relative">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-700 ease-out ${isHealthy ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
                                                                        style={{ width: `${usedPercent}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-[10px] font-bold flex items-center gap-1 ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                        {isHealthy ? '✅' : '⚠️'} {isHealthy ? `${marginPercent}% remaining` : `${Math.abs(marginPercent)}% over budget`}
                                                                    </span>
                                                                    <span className={`text-xs font-black font-mono ${isHealthy ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                        {isHealthy ? '' : '-'}€{Math.abs(margin).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        /* No Quotation Linked */
                                        <div className="py-6 flex flex-col items-center text-center gap-2">
                                            <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                                                <Receipt className="w-5 h-5" />
                                            </div>
                                            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">No quotation linked</p>
                                            <p className="text-[10px] text-neutral-400 leading-relaxed max-w-[200px]">
                                                Link a quotation to this project to automatically track profitability and costs.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Connected Records */}
                            <ErrorBoundary componentName="LinkedRecords">
                                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm relative">
                                    <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                        <Layers className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} /> Connected
                                    </div>
                                    <div className="p-4 max-h-[300px] overflow-y-auto">
                                        <LinkedRecords databaseId={databaseId} pageId={pageId} />
                                    </div>
                                </div>
                            </ErrorBoundary>

                            {/* Budget Card */}
                            <ErrorBoundary componentName="PageFinancialAnalysis">
                                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                        <TrendingUp className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} /> Financials
                                    </div>
                                    <div className="p-4">
                                        <PageFinancialAnalysis databaseId={databaseId} pageId={pageId} costs={totalActualCost} quotationTotal={quotationFinancials.total} invoicedTotal={invoicedTotal + draftTotal} />
                                    </div>
                                </div>
                            </ErrorBoundary>
                        </div>
                    </div>
                )}

                {activeTab === 'vorderingen' && (
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm min-h-[500px] flex flex-col">
                        <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                <ClipboardCheck className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} /> Vorderingenstaten
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-500">
                                {vorderingenstaten.length} vorderingen
                            </span>
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col gap-6">
                            {/* Summary Metrics */}
                            {vorderingenstaten.length > 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* Cumulative Progress Bar */}
                                    {quotationFinancials.total > 0 && (
                                        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/50 to-emerald-50/50 dark:from-indigo-950/10 dark:to-emerald-950/10 border border-indigo-200/30 dark:border-indigo-500/10">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Cumulative Progress</p>
                                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{invoicedPercent}%</span>
                                            </div>
                                            <div className="w-full h-3 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full flex overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out"
                                                        style={{ width: `${Math.min(100, Math.round((invoicedTotal / quotationFinancials.total) * 100))}%` }}
                                                    />
                                                    {draftTotal > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.min(100 - Math.round((invoicedTotal / quotationFinancials.total) * 100), Math.round((draftTotal / quotationFinancials.total) * 100))}%` }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-[9px] font-semibold text-neutral-500">
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Gefactureerd</span>
                                                {draftTotal > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Concept</span>}
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600" /> Resterend</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stat Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-white/5 flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Aantal Vorderingen</p>
                                            <p className="text-xl font-black text-neutral-800 dark:text-neutral-100">{vorderingenstaten.length}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-500/10 flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Gefactureerd (ex. BTW)</p>
                                            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                €{invoicedTotal.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-500/10 flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Concept (ex. BTW)</p>
                                            <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                                                €{draftTotal.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        {quotationFinancials.total > 0 && (
                                            <div className="p-4 rounded-xl bg-blue-50/30 dark:bg-blue-950/10 border border-blue-200/40 dark:border-blue-500/10 flex flex-col gap-1">
                                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Nog te factureren</p>
                                                <p className={`text-xl font-black font-mono ${remainingToInvoice > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    €{Math.max(0, remainingToInvoice).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Linked Quotation Reference */}
                                    {linkedQuotation && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-200/30 dark:border-indigo-500/10 rounded-lg">
                                            <Receipt className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                            <span className="text-[10px] text-neutral-500 font-semibold">Gebaseerd op offerte:</span>
                                            <a
                                                href={`/${locale}/admin/quotations`}
                                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                            >
                                                {String(linkedQuotation.properties?.['title'] || 'Offerte')}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Main List */}
                            {vorderingenstaten.length > 0 ? (
                                <div className="space-y-4">
                                    {vorderingenstaten.map((vs: any) => {
                                        const isExpanded = !!expandedStates[vs.id];
                                        const isDraft = vs.status === 'draft';
                                        return (
                                            <div 
                                                key={vs.id} 
                                                className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                                            >
                                                {/* Card Header */}
                                                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 dark:bg-white/[0.02]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                            <ClipboardCheck className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                                                                    {vs.number}
                                                                </h3>
                                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                                    isDraft 
                                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
                                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                                }`}>
                                                                    {isDraft ? 'Concept' : 'Gefactureerd'}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-neutral-400 mt-0.5">
                                                                Aangemaakt op: {formatDate(vs.date || vs.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6 self-end sm:self-center">
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-neutral-400 font-medium">Totaal Bedrag</p>
                                                            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                                                                €{(Number(vs.totalExVat) || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                            </p>
                                                            <p className="text-[9px] text-neutral-400 font-mono">
                                                                Incl. BTW: €{(Number(vs.totalIncVat) || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setExpandedStates(prev => ({ ...prev, [vs.id]: !isExpanded }))}
                                                                className="px-3 py-1.5 border border-neutral-200 dark:border-white/10 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                                            >
                                                                {isExpanded ? 'Verberg details' : 'Toon details'}
                                                            </button>

                                                            {isDraft ? (
                                                                <button
                                                                    onClick={() => handleCreateInvoiceFromVS(vs)}
                                                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                                                    id={`vs-invoice-btn-${vs.id}`}
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Factuur Aanmaken
                                                                </button>
                                                            ) : (
                                                                <a
                                                                    href={`/${locale}/admin/invoices/${vs.invoiceId}`}
                                                                    className="px-3.5 py-1.5 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                                                >
                                                                    <ArrowUpRight className="w-3.5 h-3.5" /> Bekijk Factuur
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="p-4 border-t border-neutral-105 dark:border-white/5 bg-neutral-50/30 dark:bg-white/[0.01]">
                                                        <table className="w-full text-left text-xs border-collapse">
                                                            <thead>
                                                                <tr className="border-b border-neutral-200 dark:border-white/15 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                                                                    <th className="py-2 px-2">Beschrijving</th>
                                                                    <th className="py-2 px-2 text-right">Originele Waarde</th>
                                                                    <th className="py-2 px-2 text-right">Vorige Voortgang</th>
                                                                    <th className="py-2 px-2 text-right">Huidige Voortgang</th>
                                                                    <th className="py-2 px-2 text-right">Bedrag Periode</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {vs.items?.map((item: any) => {
                                                                    const originalTotal = (item.quantity || 1) * (item.verkoopPrice || 0);
                                                                    return (
                                                                        <tr key={item.id} className="border-b border-neutral-100 dark:border-white/5 last:border-0 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.01]">
                                                                            <td className="py-3 px-2 font-medium">
                                                                                {item.content}
                                                                            </td>
                                                                            <td className="py-3 px-2 text-right tabular-nums font-mono">
                                                                                €{originalTotal.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                                            </td>
                                                                            <td className="py-3 px-2 text-right">
                                                                                {item.previousProgress}%
                                                                            </td>
                                                                            <td className="py-3 px-2 text-right text-indigo-650 dark:text-indigo-400 font-bold">
                                                                                +{item.currentProgress}%
                                                                            </td>
                                                                            <td className="py-3 px-2 text-right font-bold text-neutral-900 dark:text-white tabular-nums font-mono">
                                                                                €{Number(item.amount).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-white/[0.01] rounded-xl border border-dashed border-neutral-200 dark:border-white/10">
                                    <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-850 text-neutral-350 dark:text-neutral-750 mb-4">
                                        <ClipboardCheck className="w-12 h-12 opacity-80" />
                                    </div>
                                    <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-350 mb-1">
                                        Geen vorderingenstaten
                                    </h3>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm text-center leading-relaxed">
                                        Er zijn nog geen vorderingenstaten gegenereerd voor dit project. Ga naar de gekoppelde offerte in de offertemodule om uw eerste vorderingstaat aan te maken.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'journal' && (
                    <JournalCard databaseId={databaseId} pageId={pageId} minHeight="500px" />
                )}

                {activeTab === 'files' && (
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm min-h-[500px]">
                        <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                            <FileText className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} /> Files
                        </div>
                        <div className="flex-1 overflow-hidden relative min-h-[400px]">
                            <ErrorBoundary componentName="FileManager">
                                <FileManager contextType="project" contextId={pageId} driveFolderId={boundDriveId} />
                            </ErrorBoundary>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
