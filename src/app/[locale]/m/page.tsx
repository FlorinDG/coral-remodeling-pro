/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { getLockedDbId } from '@/lib/lockedDbUtils';
import { Link } from "@/i18n/routing";
import {
    FileText, Plus, Camera, Users, Clock,
    ArrowUpRight, ArrowDownRight, FileSignature, ChevronRight, Building2
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
        select: {
            companyName: true, planType: true, lockedDbIds: true,
            scanQuota: true, scanCount: true,
            vatNumber: true, iban: true, street: true, city: true, logoUrl: true,
        },
    });

    const ldb = (tenant?.lockedDbIds as Record<string, string>) || {};
    const dbInvoices    = getLockedDbId('db-invoices', ldb);
    const dbPaymentsIn  = getLockedDbId('db-payments-in', ldb);
    const dbPaymentsOut = getLockedDbId('db-payments-out', ldb);
    const dbTickets     = getLockedDbId('db-tickets', ldb);

    // Date calculations
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(currentMonth);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

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

    let currentMonthIn = 0, currentMonthOut = 0;
    const thisM = now.getMonth(), thisY = now.getFullYear();


    for (const page of incomingPages) {
        const props = page.properties as Record<string, any>;
        const amount = Number(props['amount'] ?? 0);
        if (!amount) continue;
        let dateObj = page.createdAt;
        if (props['date']) { const p = new Date(props['date']); if (!isNaN(p.getTime())) dateObj = p; }
        const m = dateObj.getMonth(), y = dateObj.getFullYear();
        if (m === thisM && y === thisY) currentMonthIn += amount;
    }

    for (const page of outgoingPages) {
        const props = page.properties as Record<string, any>;
        const amount = Number(props['amount'] ?? 0);
        if (!amount) continue;
        let dateObj = page.createdAt;
        if (props['date']) { const p = new Date(props['date']); if (!isNaN(p.getTime())) dateObj = p; }
        const m = dateObj.getMonth(), y = dateObj.getFullYear();
        if (m === thisM && y === thisY) currentMonthOut += amount;
    }

    const netCurrentMonth = currentMonthIn - currentMonthOut;
    const companyName = tenant?.companyName || 'My Business';
    const scansUsed = tenant?.scanCount ?? 0;
    const scanQuota = tenant?.scanQuota ?? 30;

    // Profile completeness — CTA hides when all 5 fields are present
    const isProfileComplete = !!(
        tenant?.companyName &&
        tenant?.vatNumber &&
        tenant?.iban &&
        (tenant?.street || tenant?.city) &&
        tenant?.logoUrl
    );

    const monthLabel = now.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

    return (
        <div className="max-w-lg mx-auto flex flex-col gap-0 min-h-[calc(100vh-8rem)]">

            {/* ═══════════════════════════════════════════════════════
                TOP THIRD — Company identity + key stats strip
            ═══════════════════════════════════════════════════════ */}
            <div className="px-4 pt-5 pb-4 space-y-3">
                {/* Company name + date */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight leading-tight">{companyName}</h1>
                        <p className="text-xs text-neutral-400 mt-0.5 font-medium">{monthLabel}</p>
                    </div>
                    <div className="text-right mt-1">
                        <p className={`text-xl font-black ${netCurrentMonth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {netCurrentMonth >= 0 ? '+' : ''}€{Math.abs(netCurrentMonth).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                            {netCurrentMonth >= 0 ? t('dash_net_profit') : t('dash_net_loss')}
                        </p>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-2.5 text-center">
                        <p className="text-lg font-black text-blue-600 dark:text-blue-400">{totalInvoices}</p>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide mt-0.5">{t('nav_invoices')}</p>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-2.5 text-center">
                        <p className="text-lg font-black text-amber-500">{draftCount}</p>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide mt-0.5">{t('dash_drafts')}</p>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-2.5 text-center">
                        <p className="text-lg font-black text-neutral-700 dark:text-neutral-200">{totalExpenses}</p>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide mt-0.5">{t('nav_expenses')}</p>
                    </div>
                </div>

                {/* Cash in / out this month */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-600">€{currentMonthIn.toLocaleString(locale, { minimumFractionDigits: 0 })}</span>
                        <span className="text-[10px] text-neutral-400">{t('dash_in')}</span>
                    </div>
                    <div className="w-px h-4 bg-neutral-200 dark:bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-bold text-red-500">€{currentMonthOut.toLocaleString(locale, { minimumFractionDigits: 0 })}</span>
                        <span className="text-[10px] text-neutral-400">{t('dash_out')}</span>
                    </div>
                    {unpaidCount > 0 && (
                        <>
                            <div className="w-px h-4 bg-neutral-200 dark:bg-white/10" />
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-400" />
                                <span className="text-[10px] text-blue-500 font-bold">{unpaidCount} {t('dash_awaiting_payment')}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                MIDDLE THIRD — Three primary action buttons
            ═══════════════════════════════════════════════════════ */}
            <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-3">
                    {/* Create Invoice */}
                    <Link
                        href="/m/invoices/new"
                        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-white font-bold shadow-lg active:scale-[0.97] transition-all"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold text-center leading-tight px-1">{t('dash_create_invoice')}</span>
                    </Link>

                    {/* Scan Expense */}
                    <Link
                        href="/m/expenses"
                        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-neutral-900 dark:bg-white/10 text-white font-bold shadow-lg active:scale-[0.97] transition-all"
                    >
                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                            <Camera className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold text-center leading-tight px-1">{t('dash_add_expense')}</span>
                        <span className="text-[9px] opacity-50 font-medium">{scansUsed}/{scanQuota}</span>
                    </Link>

                    {/* Add Client */}
                    <Link
                        href="/m/clients"
                        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-blue-600 text-white font-bold shadow-lg active:scale-[0.97] transition-all"
                    >
                        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold text-center leading-tight px-1">{t('dash_add_client')}</span>
                    </Link>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BOTTOM THIRD — Secondary links + profile CTA
            ═══════════════════════════════════════════════════════ */}
            <div className="px-4 pb-6 space-y-3 flex-1">

                {/* Quick nav tiles */}
                <div className="grid grid-cols-2 gap-2">
                    <Link href="/m/invoices" className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-3 flex items-center justify-between hover:border-[var(--brand-color)]/30 transition-all">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-bold">{t('nav_invoices')}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
                    </Link>
                    <Link href="/m/quotes" className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-3 flex items-center justify-between hover:border-[var(--brand-color)]/30 transition-all">
                        <div className="flex items-center gap-2">
                            <FileSignature className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-bold">{t('nav_quotes')}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
                    </Link>
                </div>

                {/* Profile completion CTA — hides when profile complete */}
                {!isProfileComplete && (
                    <Link
                        href="/admin/settings/company-info"
                        className="block bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/30 rounded-2xl p-4 active:scale-[0.99] transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 15%, transparent)' }}>
                                <Building2 className="w-4.5 h-4.5" style={{ color: 'var(--brand-color, #d35400)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{t('profile_cta_title')}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{t('profile_cta_desc')}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0 mt-2.5" />
                        </div>
                        <div className="mt-3">
                            <span
                                className="inline-block text-xs font-bold text-white px-3 py-1.5 rounded-lg"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                            >
                                {t('profile_cta_btn')} →
                            </span>
                        </div>
                    </Link>
                )}

                {/* Scan quota indicator */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-white/5 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t('exp_ocr_scans')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-orange-400 transition-all"
                                style={{ width: `${Math.min(100, (scansUsed / scanQuota) * 100)}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-500">{scansUsed}/{scanQuota}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
