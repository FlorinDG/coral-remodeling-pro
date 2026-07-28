"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { hrFetch, hrUpdate } from '@/components/time-tracker/lib/hr-api';
import { Loader2, FileText, Download, AlertCircle, Image as ImageIcon, Check, X, Clock, Hourglass, Plus } from 'lucide-react';
import { formatISO, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { ManualEntryModal } from './ManualEntryModal';
import { TimesheetFilterBar } from './TimesheetFilterBar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { nl } from 'date-fns/locale';
import { format } from 'date-fns';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    [key: string]: unknown;
}

interface ClockEntry {
    id: string;
    userId: string;
    clockInTime: string;
    clockOutTime: string | null;
    taskDescription: string | null;
    approvalStatus: string | null;
    photos: string[] | null;
    noBreak?: boolean;
    user?: Employee;
}

function TimesheetsContent() {
    const t = useTranslations('Hr.timesheets');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [entries, setEntries] = useState<ClockEntry[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    
    // Grouping & Selection state
    const [groupBy, setGroupBy] = useState<'flat' | 'worker' | 'project'>('flat');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

    const toggleGroup = (id: string) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSelectAll = (filteredData: any[]) => {
        if (selectedEntries.size === filteredData.length && filteredData.length > 0) {
            setSelectedEntries(new Set());
        } else {
            setSelectedEntries(new Set(filteredData.map(e => e.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedEntries);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedEntries(next);
    };

    const handleBulkAction = async (action: 'approved' | 'denied') => {
        const selectedHours = entries
            .filter((e: any) => selectedEntries.has(e.id))
            .reduce((acc, e: any) => acc + (e.hoursDecimal || 0), 0)
            .toFixed(2);
            
        const actionText = action === 'approved' ? t('approve', { fallback: 'Approve' }) : t('deny', { fallback: 'Deny' });
        if (!window.confirm(`${actionText} ${selectedEntries.size} entries, ${selectedHours} h?`)) return;
        
        setLoading(true);
        try {
            for (const id of Array.from(selectedEntries)) {
                await hrUpdate('clock-entries', id, { approvalStatus: action });
            }
            setSelectedEntries(new Set());
            await fetchData();
        } catch (err) {
            console.error(err);
            alert(t('bulkActionFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (format: string) => {
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.set('format', format);
        window.location.href = `/api/hr/timesheet-export?${currentParams.toString()}`;
    };
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const currentParams = new URLSearchParams(searchParams.toString());
            if (!currentParams.has('from') || !currentParams.has('to')) {
                const now = new Date();
                currentParams.set('from', formatISO(startOfMonth(now)));
                currentParams.set('to', formatISO(endOfMonth(now)));
                currentParams.set('period', 'thisMonth');
            }
            
            const qs = `?${currentParams.toString()}`;
            const data = await hrFetch<{ entries: ClockEntry[], summary: any }>(`timesheet-reports${qs}`);
            
            const mappedEntries = data.entries.map((e: any) => ({
                ...e,
                userName: e.workerName === 'Unknown' ? t('unknownWorker', { fallback: 'Onbekend' }) : e.workerName
            }));

            setEntries(mappedEntries as ClockEntry[]);
            setSummary(data.summary);
        } catch (err: any) {
            console.error('Failed to fetch timesheets:', err);
            setError(err.message || 'Failed to load timesheets.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [searchParams]);

    const setApprovalStatusFilter = (status: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (status) params.set('approvalStatus', status);
        else params.delete('approvalStatus');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const currentStatus = searchParams.get('approvalStatus') || 'all';

    const handleApproval = async (id: string, status: 'approved' | 'denied') => {
        try {
            await hrUpdate('clock-entries', id, { approvalStatus: status });
            setEntries(prev => prev.map(e => e.id === id ? { ...e, approvalStatus: status } : e));
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-neutral-500 mt-4">{t('loading')}</p>
            </div>
        );
    }

    const renderRow = (entry: any) => {
        const start = new Date(entry.clockInTime);
        const end = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
        const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
        
        return (
            <tr key={entry.id} className="hover:bg-neutral-50/50 dark:hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4">
                    <input 
                        type="checkbox" 
                        className="rounded border-neutral-300"
                        checked={selectedEntries.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                    />
                </td>
                <td className="px-6 py-4">
                    <div className="font-semibold text-sm">{format(start, 'dd MMM yyyy')}</div>
                    <div className="text-xs text-neutral-500">
                        {format(start, 'HH:mm')} - {end ? format(end, 'HH:mm') : '?'}
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="font-medium text-sm">{entry.userName}</div>
                    <div className="text-xs text-neutral-500 flex gap-1 flex-wrap mt-1">
                        {entry.projectName || t('unassignedProject', { fallback: 'Niet toegewezen' })}
                        {entry.flags && entry.flags.map((f: string) => (
                            <span key={f} className="bg-orange-100 text-orange-700 px-1.5 rounded-sm uppercase tracking-widest" style={{ fontSize: '9px' }}>{f}</span>
                        ))}
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="font-bold text-sm">
                        {entry.clockOutTime 
                            ? `${Math.floor(duration.totalMinutes / 60)}${t('hoursShort')} ${duration.totalMinutes % 60}${t('minutesShort')}`
                            : <span className="text-orange-500 text-xs px-2 py-1 bg-orange-50 rounded-full flex items-center w-max gap-1"><Clock className="w-3 h-3"/> {t('statusLooptNog')}</span>
                        }
                    </div>
                </td>
                <td className="px-6 py-4">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 max-w-xs">{entry.taskDescription || <span className="italic text-neutral-400">{t('na')}</span>}</p>
                </td>
                <td className="px-6 py-4">
                    {entry.approvalStatus === 'approved' ? (
                        <div className="flex flex-col">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 w-max">
                                <Check className="w-3 h-3 mr-1" />
                                {t('statusGoedgekeurd')}
                            </span>
                            {entry.approvedBy && <span className="text-[10px] text-neutral-400 mt-1">by {entry.approvedBy.slice(0,6)}</span>}
                        </div>
                    ) : entry.approvalStatus === 'denied' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 w-max">
                            <X className="w-3 h-3 mr-1" />
                            {t('statusGeweigerd')}
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 w-max">
                            <Hourglass className="w-3 h-3 mr-1 text-neutral-500" />
                            {t('statusTeBeoordelen')}
                        </span>
                    )}
                </td>
                <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {entry.approvalStatus !== 'approved' && entry.clockOutTime && (
                            <Button size="sm" variant="ghost" onClick={() => handleApproval(entry.id, 'approved')} className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50">{t('approve')}</Button>
                        )}
                        {entry.approvalStatus !== 'denied' && (
                            <Button size="sm" variant="ghost" onClick={() => handleApproval(entry.id, 'denied')} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">{t('deny')}</Button>
                        )}
                        <Link href={`/admin/hr/timesheets/${entry.id}`}>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider ml-2">
                                <FileText className="w-3.5 h-3.5" />
                                {t('viewTimesheet')}
                            </Button>
                        </Link>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="flex flex-col gap-6 p-6">
                <header className="flex items-center justify-between">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-8 flex-1">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">{t('title')}</h1>
                            <p className="text-sm text-neutral-500">{t('subtitle')}</p>
                        </div>
                        {summary && !error && (
                            <div className="flex flex-wrap items-center gap-4 xl:gap-6 text-sm">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{t('totalHours', { fallback: 'Totaal uren' })}</span>
                                    <span className="font-black text-lg leading-none">{summary.totalHours}u</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 dark:bg-white/10 hidden xl:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{t('billableInternal', { fallback: 'Factureerbaar / Intern' })}</span>
                                    <span className="font-black text-lg leading-none">{summary.billableHours}u <span className="text-neutral-400 font-normal">/ {summary.internalHours}u</span></span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 dark:bg-white/10 hidden xl:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{t('approvedPending', { fallback: 'Goedgekeurd / Te beoordelen' })}</span>
                                    <span className="font-black text-lg leading-none text-green-600">{summary.approvedHours}u <span className="text-orange-500 font-normal">/ {summary.pendingHours}u</span></span>
                                </div>
                                <div className="w-px h-8 bg-neutral-200 dark:bg-white/10 hidden xl:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{t('unattributedHours', { fallback: 'Niet toegewezen uren' })}</span>
                                    <span className="font-black text-lg leading-none text-red-500">
                                        {entries.filter(e => !(e as any).projectId).reduce((acc, e) => acc + ((e as any).hoursDecimal || 0), 0).toFixed(2)}u
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-10 rounded-xl">
                                    <Download className="w-4 h-4 mr-2" />
                                    {t('export')}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport('pdf')}>{t('exportPdf', { fallback: 'PDF' })}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('xlsx')}>{t('exportXlsx', { fallback: 'Excel' })}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('csv')}>{t('exportCsv', { fallback: 'CSV' })}</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-10 px-4 rounded-xl shadow-sm transition-all shadow-orange-500/20">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('manualAdd')}
                        </Button>
                    </div>
                </header>

                <div className="flex flex-col gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-sm mb-2">
                    <TimesheetFilterBar />

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setApprovalStatusFilter(null)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStatus === 'all' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {t('all')}
                            </button>
                            <button 
                                onClick={() => setApprovalStatusFilter('pending')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${currentStatus === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {t('statusTeBeoordelen')}
                                {summary?.openEntries > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{summary.openEntries}</span>}
                            </button>
                            <button 
                                onClick={() => setApprovalStatusFilter('approved')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {t('statusGoedgekeurd')}
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {selectedEntries.size > 0 && (
                                <div className="flex items-center gap-2 mr-4 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
                                    <span className="text-sm font-bold text-orange-800">{t('selectedCount', { count: selectedEntries.size })}</span>
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white ml-2" onClick={() => handleBulkAction('approved')}>{t('bulkApprove')}</Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleBulkAction('denied')}>{t('bulkDeny')}</Button>
                                </div>
                            )}
                            
                            <div className="bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl flex items-center text-sm font-medium">
                                <button onClick={() => setGroupBy('flat')} className={`px-3 py-1 rounded-lg ${groupBy === 'flat' ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'}`}>{t('flat')}</button>
                                <button onClick={() => setGroupBy('worker')} className={`px-3 py-1 rounded-lg ${groupBy === 'worker' ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'}`}>{t('byWorker')}</button>
                                <button onClick={() => setGroupBy('project')} className={`px-3 py-1 rounded-lg ${groupBy === 'project' ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'}`}>{t('byProject')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <ManualEntryModal 
                    open={modalOpen} 
                    onOpenChange={setModalOpen} 
                    onSuccess={fetchData} 
                />

                {/* Old stat cards removed in favor of inline header stats */}

                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm mt-4">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-50/50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                                <th className="px-6 py-4 w-12">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-neutral-300"
                                        checked={entries.length > 0 && selectedEntries.size === entries.length}
                                        onChange={() => handleSelectAll(entries)}
                                    />
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('date')}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('workforceMember')}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('duration')}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('description')}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('status')}</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200/50 dark:divide-white/5">
                            {groupBy === 'flat' && entries.map((entry: any) => renderRow(entry))}

                            {/* Group By Worker Rendering */}
                            {groupBy === 'worker' && summary && summary.rollups?.byWorker.map((worker: any) => (
                                <React.Fragment key={worker.userId}>
                                    <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-white/10 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => toggleGroup(worker.userId)}>
                                        <td colSpan={7} className="px-6 py-4 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold flex items-center gap-2">
                                                    {expandedGroups.has(worker.userId) ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                                    {worker.workerName}
                                                </span>
                                                <span className="font-medium bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-lg">{worker.hours.toFixed(2)} {t('hoursShort')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedGroups.has(worker.userId) && entries.filter((e: any) => e.userId === worker.userId).map((entry: any) => renderRow(entry))}
                                </React.Fragment>
                            ))}
                            
                            {/* Group By Project Rendering */}
                            {groupBy === 'project' && summary && summary.rollups?.byProject.map((project: any) => (
                                <React.Fragment key={project.projectId}>
                                    <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-white/10 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => toggleGroup(project.projectId)}>
                                        <td colSpan={7} className="px-6 py-4 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold flex items-center gap-2">
                                                    {expandedGroups.has(project.projectId) ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                                    {project.projectName}
                                                </span>
                                                <span className="font-medium bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-lg">{project.hours.toFixed(2)} {t('hoursShort')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedGroups.has(project.projectId) && entries.filter((e: any) => e.projectId === project.projectId).map((entry: any) => renderRow(entry))}
                                </React.Fragment>
                            ))}

                            {/* Unattributed Project Bucket */}
                            {groupBy === 'project' && summary && entries.filter((e: any) => !e.projectId).length > 0 && (
                                <React.Fragment key="unassigned">
                                    <tr className="bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-500/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors" onClick={() => toggleGroup('unassigned')}>
                                        <td colSpan={7} className="px-6 py-4 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                                    {expandedGroups.has('unassigned') ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                                    {t('unassignedProject', { fallback: 'Niet toegewezen uren' })}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-red-600 underline hover:no-underline" onClick={(e) => { e.stopPropagation(); /* TODO Bulk assign action */ }}>Bulk Assign</span>
                                                    <span className="font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-3 py-1 rounded-lg">
                                                        {entries.filter((e: any) => !e.projectId).reduce((acc: number, e: any) => acc + (e.hoursDecimal || 0), 0).toFixed(2)} {t('hoursShort')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedGroups.has('unassigned') && entries.filter((e: any) => !e.projectId).map((entry: any) => renderRow(entry))}
                                </React.Fragment>
                            )}
                        </tbody>
                    </table>

                    {error ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <AlertCircle className="w-12 h-12 text-red-200 mb-4" />
                            <p className="text-red-500 font-bold mb-1">Request failed</p>
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    ) : entries.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <AlertCircle className="w-12 h-12 text-neutral-200 mb-4" />
                            {summary?.outsidePeriodCount > 0 ? (
                                <>
                                    <p className="text-neutral-500 font-bold mb-2 text-lg">No entries in this period</p>
                                    <p className="text-neutral-400 text-sm mb-6 max-w-sm text-center">There are {summary.outsidePeriodCount} entries in total, but none match the current date filters.</p>
                                    <Button variant="outline" onClick={() => {
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.delete('from');
                                        params.delete('to');
                                        params.delete('period');
                                        router.push(`${pathname}?${params.toString()}`, { scroll: false });
                                    }}>Widen Date Range</Button>
                                </>
                            ) : (
                                <p className="text-neutral-400">{t('noEntries')}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TimesheetsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-neutral-500">Loading timesheets...</div>}>
            <TimesheetsContent />
        </Suspense>
    );
}
