"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { hrFetch, hrUpdate } from '@/lib/hr-api';
import { Loader2, FileText, Download, AlertCircle, Image as ImageIcon, Check, X, Clock, Hourglass, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { formatISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { computeWorkedDuration, formatDecimalHours, formatHoursMinutes } from '@/lib/computeWorkedDuration';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ShiftLinkReview, SHIFT_LINK_KEYS, type ShiftLinkLabels } from '@/components/shift-link/ShiftLinkReview';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { ManualEntryModal } from './ManualEntryModal';
import { TimesheetFilterBar } from './TimesheetFilterBar';
import { TimesheetEntryDetail } from '@/components/time-tracker/components/timesheets/TimesheetEntryDetail';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { nl } from 'date-fns/locale';
import { format } from 'date-fns';
import { isSelfApproved } from '@/lib/provenance';
import { describeError } from '@/lib/describe-error';
import { toast } from 'sonner';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { listInvoicesForHours, markHoursInvoiced, unmarkHoursInvoiced, invoiceSelectedHours, setHoursArchived, type InvoiceOption } from '@/lib/data/timesheet-invoicing';
import { useDatabaseStore } from '@/components/admin/database/store';

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
    approvedBy?: string | null;
    approvedAt?: string | null;
    approverName?: string | null;
    createdBy?: string | null;
    createdByName?: string | null;
    source?: string;
    notes?: string | null;
    photos: string[] | null;
    noBreak?: boolean;
    billable?: boolean;
    invoicedAt?: string | null;
    user?: Employee;
}

/** "7,50 u (07:30)" — decimals first (what the invoice uses), HH:mm in brackets. From hours as the
 *  report sends them: 2-decimal hours map back to the exact minute (one minute = 0.0167 h). */
function hoursLabel(hours: number, locale: string): string {
    const minutes = Math.round((hours || 0) * 60);
    return `${formatDecimalHours(minutes, locale)} u (${formatHoursMinutes(minutes)})`;
}

/** The report as the server sends it — kept per query for this session (TS-SPEED-1). */
interface Report { entries: ClockEntry[]; summary: any; rollups: { byWorker: any[]; byProject: any[] } }
/** TS-SPEED-1 (Florin 2026-10-08: "has to reload every time … even inside the same active session"). Each HR tab is
 *  its own page, so this screen mounted empty on every visit. The last report per query is kept for the session: a
 *  return shows it at once and refreshes it quietly. */
const reportCache = new Map<string, Report>();
/** One request per query at a time: the first visit names the period in the URL (router.replace) and reads the report
 *  at once; the effect that runs again for the new URL shares this request instead of starting a second one. */
const reportInFlight = new Map<string, Promise<Report>>();
function loadReport(key: string): Promise<Report> {
    let p = reportInFlight.get(key);
    if (!p) {
        p = hrFetch<Report>(`timesheet-reports?${key}`).finally(() => reportInFlight.delete(key));
        reportInFlight.set(key, p);
    }
    return p;
}

/** The query with the default period (this month) filled in — the key a report is cached under. */
function withDefaultPeriod(params: URLSearchParams | { toString(): string }): URLSearchParams {
    const p = new URLSearchParams(params.toString());
    if (!p.has('from') || !p.has('to')) {
        const now = new Date();
        p.set('from', format(startOfMonth(now), 'yyyy-MM-dd'));
        p.set('to', format(endOfMonth(now), 'yyyy-MM-dd'));
        p.set('period', 'thisMonth');
    }
    return p;
}

/** The By Project group of hours without a project — the same key the report route uses. */
const UNATTRIBUTED = 'unattributed';

function TimesheetsContent() {
    const t = useTranslations('Hr.timesheets');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const cached = reportCache.get(withDefaultPeriod(searchParams).toString());
    const [entries, setEntries] = useState<ClockEntry[]>(cached?.entries ?? []);
    const [summary, setSummary] = useState<any>(cached?.summary ?? null);
    // The groups of By Worker / By Project — they come BESIDE the summary (they were read from summary.rollups,
    // which never exists, so both views were empty).
    const [rollups, setRollups] = useState<Report['rollups'] | null>(cached?.rollups ?? null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(!cached);
    const [modalOpen, setModalOpen] = useState(false);
    
    // Grouping & Selection state
    const [groupBy, setGroupBy] = useState<'flat' | 'worker' | 'project'>('flat');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [unlockState, setUnlockState] = useState<{ valid: boolean, expiresAt: number | null }>({ valid: false, expiresAt: null });
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        const i = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(i);
    }, []);

    const fetchUnlockState = async () => {
        try {
            const res = await fetch('/api/hr/timesheet-unlock');
            if (res.ok) {
                const data = await res.json();
                setUnlockState({ valid: data.valid, expiresAt: data.expiresAt });
            }
        } catch (err) {
            console.error('Failed to fetch unlock state', err);
        }
    };

    const disableUnlock = async () => {
        try {
            await fetch('/api/hr/timesheet-unlock', { method: 'POST', body: JSON.stringify({ action: 'disable' }), headers: { 'Content-Type': 'application/json' }});
            setUnlockState({ valid: false, expiresAt: null });
        } catch (err) {
            console.error('Failed to disable unlock', err);
        }
    };

    useEffect(() => {
        fetchUnlockState();
    }, []);

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
            .reduce((acc, e: any) => acc + (e.hoursDecimal || 0), 0);
            
        const actionText = action === 'approved' ? t('approve', { fallback: 'Approve' }) : t('deny', { fallback: 'Deny' });
        if (!window.confirm(`${actionText} ${selectedEntries.size} entries, ${hoursLabel(selectedHours, locale)}?`)) return;
        
        setLoading(true);
        try {
            for (const id of Array.from(selectedEntries)) {
                await hrUpdate('clock-entries', id, { approvalStatus: action });
            }
            setSelectedEntries(new Set());
            await fetchData(true);
        } catch (err: any) {
            console.error('Bulk action error:', err);
            alert(err.message ? `${t('bulkActionFailed')}: ${err.message}` : t('bulkActionFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (format: string) => {
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.set('format', format);
        window.location.href = `/api/hr/timesheet-export?${currentParams.toString()}`;
    };
    /** `silent`: re-read the report without the full-page spinner — after every action, so totals,
     *  counts, approver, project and source labels match the server (they were stale until a reload). */
    const fetchData = async (silent = false) => {
        if (!silent && !reportCache.has(withDefaultPeriod(searchParams).toString())) setLoading(true);
        setError(null);
        try {
            const currentParams = withDefaultPeriod(searchParams);
            const key = currentParams.toString();
            // TS-FLASH-1 (Florin 2026-10-10: "first hangs on a no entries screen for a second or two"): the URL is given
            // its period, but the report is read NOW — it used to return here and wait for the navigation, and the
            // `finally` below cleared the spinner, so the empty table showed for the whole round trip.
            if (key !== searchParams.toString()) router.replace(`${pathname}?${key}`);

            const hit = reportCache.get(key);
            if (hit && !silent) {   // shown at once; refreshed below without the spinner
                setEntries(hit.entries); setSummary(hit.summary); setRollups(hit.rollups); setLoading(false);
            }
            const data = await loadReport(key);

            const mappedEntries = data.entries.map((e: any) => ({
                ...e,
                userName: e.workerName === 'Unknown' ? t('unknownWorker', { fallback: 'Onbekend' }) : e.workerName
            }));

            reportCache.set(key, { entries: mappedEntries as ClockEntry[], summary: data.summary, rollups: data.rollups });
            setEntries(mappedEntries as ClockEntry[]);
            setSummary(data.summary);
            setRollups(data.rollups);
        } catch (err: any) {
            console.error('Failed to fetch timesheets:', err);
            setError(`Failed to load timesheets. — ${describeError(err)}`);
        } finally {
            setLoading(false);
        }
    };
    const refresh = () => { void fetchData(true); };

    useEffect(() => {
        fetchData();
    }, [searchParams]);

    // Changes made elsewhere (the WorkHub, another tab, a colleague) arrive when this tab is shown again.
    useEffect(() => {
        let last = Date.now();
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || Date.now() - last < 15_000) return;
            last = Date.now();
            refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const setApprovalStatusFilter = (status: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (status) params.set('approvalStatus', status);
        else params.delete('approvalStatus');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const currentStatus = searchParams.get('approvalStatus') || 'all';

    // TS-INV-1 · mark / unmark the selected hours as invoiced (audited server-side)
    const [invoiceDialog, setInvoiceDialog] = useState(false);
    const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[] | null>(null);
    const [invoiceRef, setInvoiceRef] = useState('none');
    const [invoicing, setInvoicing] = useState(false);
    const openInvoiceDialog = async () => {
        setInvoiceRef('none');
        setInvoiceDialog(true);
        if (!invoiceOptions) {
            const r = await listInvoicesForHours();
            setInvoiceOptions(r.ok ? r.invoices : []);
            if (!r.ok) toast.error(`${t('invoiceListFailed')} — ${r.error}`);
        }
    };
    const confirmInvoiced = async () => {
        setInvoicing(true);
        try {
            const r = await markHoursInvoiced(Array.from(selectedEntries), invoiceRef === 'none' ? null : invoiceRef);
            if (!r.ok) throw new Error(r.detail ? `${r.error} — ${r.detail}` : r.error);
            toast.success(t('markedInvoiced', { marked: r.marked, skipped: r.skipped }));
            setInvoiceDialog(false);
            setSelectedEntries(new Set());
            refresh();
        } catch (err) {
            toast.error(describeError(err));
        } finally {
            setInvoicing(false);
        }
    };
    // TS-INV-2 · the selected hours become a DRAFT invoice, one line per worker per day. No rate and no project
    // check here (Florin 2026-10-05): price, client and project are set by a person in the invoice editor.
    const [billing, setBilling] = useState(false);
    const createInvoiceFromHours = async () => {
        if (billing) return;
        setBilling(true);
        try {
            const r = await invoiceSelectedHours(Array.from(selectedEntries));
            if (!r.ok) {
                toast.error(t(`billError.${r.error}`, { detail: r.detail ?? '' }), { duration: 8000 });
                return;
            }
            // The invoice engine reads the page from the store — put the confirmed page there first
            // (its server fallback rebuilds an invoice WITHOUT lines and client).
            useDatabaseStore.getState().addConfirmedPage(r.page);
            toast.success(t('billCreated', { count: r.invoiced, skipped: r.skipped }));
            setSelectedEntries(new Set());
            router.push(`/admin/financials/income/invoices/${r.page.id}`);
        } catch (err) {
            toast.error(describeError(err));
        } finally {
            setBilling(false);
        }
    };

    // TS-ARCH-1 · archive / restore the selection
    const archiveSelection = async (archived: boolean) => {
        const r = await setHoursArchived(Array.from(selectedEntries), archived);
        if (!r.ok) { toast.error(r.detail ? `${r.error} — ${r.detail}` : r.error); return; }
        toast.success(t(archived ? 'archivedToast' : 'restoredToast', { count: r.changed, skipped: r.skipped }));
        setSelectedEntries(new Set());
        refresh();
    };

    const unmarkInvoiced = async () => {
        const reason = window.prompt(t('unmarkReason'));
        if (!reason) return;
        const r = await unmarkHoursInvoiced(Array.from(selectedEntries), reason);
        if (!r.ok) { toast.error(r.error === 'reason_required' ? t('unmarkReason') : r.error); return; }
        toast.success(t('unmarkedInvoiced', { count: r.unmarked }));
        setSelectedEntries(new Set());
        refresh();
    };

    const handleApproval = async (id: string, status: 'approved' | 'denied') => {
        try {
            const updated = await hrUpdate('clock-entries', id, { approvalStatus: status });
            setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updated, approvalStatus: status } : e));
            refresh();
        } catch (err: any) {
            console.error('Failed to update status:', err);
            alert(`Failed to update status — ${describeError(err)}`);
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
            <React.Fragment key={entry.id}>
            <tr className="hover:bg-neutral-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === entry.id ? null : entry.id)}>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
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
                            ? hoursLabel(duration.totalMinutes / 60, locale)
                            : <span className="text-orange-500 text-xs px-2 py-1 bg-orange-50 rounded-full flex items-center w-max gap-1"><Clock className="w-3 h-3"/> {t('statusLooptNog')}</span>
                        }
                    </div>
                </td>
                <td className="px-6 py-4">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 max-w-xs">{entry.taskDescription || <span className="italic text-neutral-400">{t('na')}</span>}</p>
                </td>
                <td className="px-6 py-4">
                    {entry.invoicedAt ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 w-max" title={format(new Date(entry.invoicedAt), 'dd/MM/yyyy HH:mm')}>
                            <FileText className="w-3 h-3 mr-1" />
                            {t('statusInvoiced')}
                        </span>
                    ) : entry.approvalStatus === 'approved' ? (
                        <div className="flex flex-col">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 w-max">
                                <Check className="w-3 h-3 mr-1" />
                                {t('statusGoedgekeurd')}
                            </span>
                            {entry.approvedBy && (
                                <span className="text-[10px] text-neutral-500 mt-1 leading-tight">
                                    {isSelfApproved(entry)
                                        ? t('selfApprovedBy', { name: entry.approverName || t('admin', { fallback: 'Beheerder' }) })
                                        : t('approvedByWorker', { name: entry.approverName || t('admin', { fallback: 'Beheerder' }) })}
                                    {entry.approvedAt && (
                                        <span className="block text-[9px] text-neutral-400">
                                            {format(new Date(entry.approvedAt), 'dd/MM/yyyy HH:mm')}
                                        </span>
                                    )}
                                </span>
                            )}
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
                    {entry.billable === false && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 w-max">
                            {t('statusNonBillable')}
                        </span>
                    )}
                </td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                        {entry.approvalStatus !== 'approved' && (
                            <Button 
                                size="sm" 
                                variant="outline" 
                                disabled={!entry.clockOutTime}
                                title={!entry.clockOutTime ? t('cannotApproveRunning', { fallback: 'Lopende dienst kan niet worden goedgekeurd' }) : undefined}
                                onClick={() => handleApproval(entry.id, 'approved')} 
                                className="h-8 border-green-200 text-green-600 hover:text-green-700 hover:bg-green-50 disabled:opacity-50"
                            >
                                {t('approve')}
                            </Button>
                        )}
                        {entry.approvalStatus !== 'denied' && (
                            <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleApproval(entry.id, 'denied')} 
                                className="h-8 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                {t('deny')}
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider ml-2" 
                            onClick={() => setExpandedRowId(expandedRowId === entry.id ? null : entry.id)}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            {expandedRowId === entry.id ? t('hideDetail', { fallback: 'Verberg details' }) : t('viewTimesheet')}
                        </Button>
                    </div>
                </td>
            </tr>
            {expandedRowId === entry.id && (
                <tr key={`${entry.id}-detail`} className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                    <td colSpan={7} className="p-0">
                        <TimesheetEntryDetail 
                            entry={entry} 
                            onUpdate={(updated) => { setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updated } : e)); refresh(); }} 
                            unlockTokenValid={unlockState.valid && (!unlockState.expiresAt || unlockState.expiresAt > nowMs)} 
                        />
                    </td>
                </tr>
            )}
        </React.Fragment>
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
                        {unlockState.valid && unlockState.expiresAt && unlockState.expiresAt > nowMs && (
                            <button 
                                onClick={disableUnlock}
                                aria-pressed="true"
                                className={`
                                    ml-4 px-4 py-2 rounded-lg font-bold text-sm text-left leading-tight shadow-sm border transition-colors cursor-pointer
                                    ${(unlockState.expiresAt - nowMs) < 300000 
                                        ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200' 
                                        : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'}
                                `}
                            >
                                {t('editingApprovedOn', { fallback: 'Editing of approved hours is ON' })}<br/>
                                <span className="font-normal text-xs">
                                    {(unlockState.expiresAt - nowMs) < 300000 ? 'Expires in ' : 'Expires in '} 
                                    {Math.ceil((unlockState.expiresAt - nowMs) / 60000)} min — click to turn off
                                </span>
                            </button>
                        )}
                        {summary && !error && (
                            /* Each its own category (Florin 2026-10-08): billable · internal · approved · to review. */
                            <div className="flex flex-wrap items-center gap-4 xl:gap-6 text-sm">
                                {([
                                    ['totalHours', 'Totaal uren', summary.totalHours, ''],
                                    ['billableHours', 'Factureerbaar', summary.billableHours, ''],
                                    ['internalHours', 'Intern', summary.internalHours, 'text-neutral-500'],
                                    ['approvedHours', 'Goedgekeurd', summary.approvedHours, 'text-green-600'],
                                    ['toReviewHours', 'Te beoordelen', summary.pendingHours, 'text-orange-500'],
                                    ['unattributedHours', 'Niet toegewezen uren', entries.filter(e => !(e as any).projectId).reduce((acc, e) => acc + ((e as any).hoursDecimal || 0), 0), 'text-red-500'],
                                ] as const).map(([key, fallback, hours, tone], i) => (
                                    <React.Fragment key={key}>
                                        {i > 0 && <div className="w-px h-8 bg-neutral-200 dark:bg-white/10 hidden xl:block"></div>}
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{t(key, { fallback })}</span>
                                            <span className={`font-black text-lg leading-none ${tone}`}>{hoursLabel(hours, locale)}</span>
                                        </div>
                                    </React.Fragment>
                                ))}
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

                        <Button variant="outline" className="h-10 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                            disabled={selectedEntries.size === 0 || billing} onClick={createInvoiceFromHours}
                            title={selectedEntries.size === 0 ? t('billSelectFirst') : undefined}>
                            <FileText className="w-4 h-4 mr-2" />
                            {t('billButton')}{selectedEntries.size > 0 ? ` (${selectedEntries.size})` : ''}
                        </Button>

                        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-10 px-4 rounded-xl shadow-sm transition-all shadow-orange-500/20">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('manualAdd')}
                        </Button>
                    </div>
                </header>

                {/* SHIFT-LINK-1 — hours not (or wrongly) linked to a planned shift, editable suggestion */}
                <ShiftLinkReview locale={locale} showWorker days={31} onLinked={refresh}
                    labels={Object.fromEntries(SHIFT_LINK_KEYS.map(k => [k, t(`shiftLink.${k}`)])) as unknown as ShiftLinkLabels} />

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
                            <button 
                                onClick={() => setApprovalStatusFilter('denied')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStatus === 'denied' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {t('statusGeweigerd')}
                            </button>
                            <button 
                                onClick={() => setApprovalStatusFilter('invoiced')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStatus === 'invoiced' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {t('statusInvoiced')}
                            </button>
                            <button 
                                onClick={() => setApprovalStatusFilter('nonBillable')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStatus === 'nonBillable' ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {t('statusNonBillable')}
                            </button>
                            <button 
                                onClick={() => setApprovalStatusFilter('archived')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStatus === 'archived' ? 'bg-neutral-500 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                            >
                                {t('statusArchived')}
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {selectedEntries.size > 0 && (
                                <div className="flex items-center gap-2 mr-4 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
                                    <span className="text-sm font-bold text-orange-800">{t('selectedCount', { count: selectedEntries.size })}</span>
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white ml-2" onClick={() => handleBulkAction('approved')}>{t('bulkApprove')}</Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleBulkAction('denied')}>{t('bulkDeny')}</Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50" onClick={openInvoiceDialog}>{t('bulkInvoiced')}</Button>
                                    {currentStatus === 'archived'
                                        ? <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => archiveSelection(false)}>{t('bulkRestore')}</Button>
                                        : <Button size="sm" variant="ghost" className="h-7 text-xs text-neutral-600" onClick={() => archiveSelection(true)}>{t('bulkArchive')}</Button>}
                                    {currentStatus === 'invoiced' && (
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-neutral-600" onClick={unmarkInvoiced}>{t('bulkUninvoice')}</Button>
                                    )}
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

                {/* TS-INV-2: no rate dialog — the draft opens in the invoice editor, priced there by a person. */}

                <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>{t('bulkInvoiced')}</DialogTitle></DialogHeader>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('invoiceDialogHint', { count: selectedEntries.size })}</p>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-neutral-500">{t('invoiceOptional')}</span>
                            {invoiceOptions === null ? (
                                <div className="h-10 rounded-md bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                            ) : (
                                <SearchableSelect value={invoiceRef} onChange={setInvoiceRef} placeholder={t('invoiceOptional')}
                                    options={[{ value: 'none', label: t('noInvoiceLink') }, ...invoiceOptions.map(o => ({ value: o.id, label: o.label }))]} />
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInvoiceDialog(false)}>{t('cancel', { fallback: 'Annuleren' })}</Button>
                            <Button onClick={confirmInvoiced} disabled={invoicing} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {invoicing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{t('bulkInvoiced')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <ManualEntryModal 
                    open={modalOpen} 
                    onOpenChange={setModalOpen} 
                    onSuccess={refresh} 
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
                            {groupBy === 'worker' && rollups?.byWorker.map((worker: any) => (
                                <React.Fragment key={worker.userId}>
                                    <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-white/10 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => toggleGroup(worker.userId)}>
                                        <td colSpan={7} className="px-6 py-4 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold flex items-center gap-2">
                                                    {expandedGroups[worker.userId] ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                                    {worker.workerName}
                                                </span>
                                                <span className="font-medium bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-lg">{hoursLabel(worker.hours, locale)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedGroups[worker.userId] && entries.filter((e: any) => e.userId === worker.userId).map((entry: any) => renderRow(entry))}
                                </React.Fragment>
                            ))}
                            
                            {/* Group By Project Rendering */}
                            {groupBy === 'project' && rollups?.byProject.map((project: any) => (
                                <React.Fragment key={project.projectId}>
                                    <tr className={`border-b cursor-pointer transition-colors ${project.projectId === UNATTRIBUTED
                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-900/20'
                                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-neutral-700'}`} onClick={() => toggleGroup(project.projectId)}>
                                        <td colSpan={7} className="px-6 py-4 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className={`font-bold flex items-center gap-2 ${project.projectId === UNATTRIBUTED ? 'text-red-700 dark:text-red-400' : ''}`}>
                                                    {expandedGroups[project.projectId] ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                                    {project.projectId === UNATTRIBUTED ? t('unassignedProject', { fallback: 'Niet toegewezen uren' }) : project.projectName}
                                                </span>
                                                <span className="font-medium bg-neutral-200 dark:bg-neutral-700 px-3 py-1 rounded-lg">{hoursLabel(project.hours, locale)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedGroups[project.projectId] && entries.filter((e: any) => (e.projectId || UNATTRIBUTED) === project.projectId).map((entry: any) => renderRow(entry))}
                                </React.Fragment>
                            ))}

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
