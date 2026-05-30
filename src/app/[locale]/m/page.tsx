/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { getLockedDbId } from '@/lib/lockedDbUtils';
import { Link } from "@/i18n/routing";
import { CashFlowChart } from "@/components/admin/dashboard/DashboardCharts";
import {
    FileText, Plus, Camera, Receipt, TrendingUp, Clock,
    ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { getTranslations } from "next-intl/server";

async function getMonthlyFinancials(databaseId: string, tenantId: string, since: Date) {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true },
    });
    if (!db || db.tenantId !== tenantId) return [];
    return prisma.globalPage.findMany({
        where: { databaseId, createdAt: { gte: since } },
        select: { properties: true, createdAt: true },
    });
}

async function countPagesByStatus(databaseId: string, tenantId: string, propKey: string, optId: string): Promise<number> {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true },
    });
    if (!db || db.tenantId !== tenantId) return 0;
    return prisma.globalPage.count({
        where: { databaseId, properties: { path: [propKey], equals: optId } },
    });
}

async function countPages(databaseId: string, tenantId: string): Promise<number> {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { id: true, tenantId: true, _count: { select: { pages: true } } },
    });
    if (!db || db.tenantId !== tenantId) return 0;
    return db._count.pages;
}

export default async function MobileDashboard({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('Mobile');
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
        return (
            <div className="flex items-center justify-center p-12 text-center">
                <p className="text-sm text-neutral-500">Session expired. Please sign in again.</p>
            </div>
        );
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { companyName: true, planType: true, lockedDbIds: true, scanQuota: true, scanCount: true },
    });

    const ldb = (tenant?.lockedDbIds as Record<string, string>) || {};
    const dbInvoices    = getLockedDbId('db-invoices', ldb);
    const dbExpenses    = getLockedDbId('db-expenses', ldb);
    const dbTickets     = getLockedDbId('db-tickets', ldb);
    const dbPaymentsIn  = getLockedDbId('db-payments-in', ldb);
    const dbPaymentsOut = getLockedDbId('db-payments-out', ldb);

    // Date calculations
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(currentMonth);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const last6Months = [...Array(6)].map((_, i) => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - (5 - i));
        return {
            date: d.toLocaleDateString(locale, { month: 'short' }),
            incoming: 0,
            outgoing: 0,
            month: d.getMonth(),
            year: d.getFullYear(),
        };
    });

    // Fetch data in parallel
    const [
        incomingPages,
        outgoingPages,
        draftCount,
        unpaidCount,
        totalInvoices,
        totalExpenses,
    ] = await Promise.all([
        getMonthlyFinancials(dbPaymentsIn, tenantId, sixMonthsAgo),
        getMonthlyFinancials(dbPaymentsOut, tenantId, sixMonthsAgo),
        countPagesByStatus(dbInvoices, tenantId, 'status', 'opt-draft'),
        countPagesByStatus(dbInvoices, tenantId, 'status', 'opt-sent'),
        countPages(dbInvoices, tenantId),
        countPages(dbTickets, tenantId),
    ]);

    let sumIncoming = 0, sumOutgoing = 0;
    let currentMonthIn = 0, currentMonthOut = 0;
    const thisM = now.getMonth(), thisY = now.getFullYear();

    for (const page of incomingPages) {
        const props = page.properties as Record<string, any>;
        const amount = Number(props['amount'] ?? 0);
        if (!amount) continue;
        let dateObj = page.createdAt;
        if (props['date']) { const p = new Date(props['date']); if (!isNaN(p.getTime())) dateObj = p; }
        const m = dateObj.getMonth(), y = dateObj.getFullYear();
        const slot = last6Months.find(s => s.month === m && s.year === y);
        if (slot) slot.incoming += amount;
        sumIncoming += amount;
        if (m === thisM && y === thisY) currentMonthIn += amount;
    }

    for (const page of outgoingPages) {
        const props = page.properties as Record<string, any>;
        const amount = Number(props['amount'] ?? 0);
        if (!amount) continue;
        let dateObj = page.createdAt;
        if (props['date']) { const p = new Date(props['date']); if (!isNaN(p.getTime())) dateObj = p; }
        const m = dateObj.getMonth(), y = dateObj.getFullYear();
        const slot = last6Months.find(s => s.month === m && s.year === y);
        if (slot) slot.outgoing += amount;
        sumOutgoing += amount;
        if (m === thisM && y === thisY) currentMonthOut += amount;
    }

    const netCashFlow = sumIncoming - sumOutgoing;
    const netCurrentMonth = currentMonthIn - currentMonthOut;

    const companyName = tenant?.companyName || 'My Business';
    const scansUsed = tenant?.scanCount ?? 0;
    const scanQuota = tenant?.scanQuota ?? 30;

    return (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
            {/* ── Hero: Company Name + Date ── */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-xl font-black tracking-tight">{companyName}</h1>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <div className="text-right">
                    <p className={`text-lg font-black ${netCurrentMonth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        €{Math.abs(netCurrentMonth).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                        {netCurrentMonth >= 0 ? t('dash_net_profit') : t('dash_net_loss')} {t('dash_this_month')}
                    </p>
                </div>
            </div>

            {/* ── Cash Flow Chart ── */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xs font-bold flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        {t('dash_cash_flow')}
                    </h2>
                    <span className={`text-xs font-black ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        €{netCashFlow.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                </div>
                <div className="h-[160px]">
                    <CashFlowChart data={last6Months} />
                </div>
            </div>

            {/* ── Primary Action Buttons ── */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/m/invoices/new"
                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-white font-bold shadow-lg active:scale-[0.98] transition-all"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-sm">{t('dash_create_invoice')}</span>
                </Link>

                <Link
                    href="/m/expenses"
                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-neutral-900 dark:bg-white/10 text-white font-bold shadow-lg active:scale-[0.98] transition-all"
                >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-sm">{t('dash_add_expense')}</span>
                    <span className="text-[9px] opacity-60 font-medium">{scansUsed}/{scanQuota} {t('dash_scans')}</span>
                </Link>
            </div>

            {/* ── Quick Stats ── */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/m/invoices" className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm hover:border-[var(--brand-color)]/30 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{t('nav_invoices')}</span>
                    </div>
                    <p className="text-2xl font-black">{totalInvoices}</p>
                    {draftCount > 0 && (
                        <p className="text-[10px] font-semibold text-amber-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {draftCount} {t('dash_drafts')}
                        </p>
                    )}
                    {unpaidCount > 0 && (
                        <p className="text-[10px] font-semibold text-blue-500 mt-0.5">
                            {unpaidCount} {t('dash_awaiting_payment')}
                        </p>
                    )}
                </Link>

                <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <Receipt className="w-4 h-4 text-emerald-500" />
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{t('dash_this_month')}</span>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-500 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> {t('dash_in')}</span>
                            <span className="text-xs font-black text-emerald-600">€{currentMonthIn.toLocaleString(locale, { minimumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-500 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> {t('dash_out')}</span>
                            <span className="text-xs font-black text-red-500">€{currentMonthOut.toLocaleString(locale, { minimumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
