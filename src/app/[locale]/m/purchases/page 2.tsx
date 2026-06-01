/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { getLockedDbId } from "@/lib/lockedDbUtils";
import { Receipt, Building2, Calendar, AlertCircle } from "lucide-react";
import { getTranslations } from 'next-intl/server';

export default async function MobilePurchasesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('Mobile');
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) return <div className="p-12 text-center text-sm text-neutral-500">Session expired.</div>;

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true, planType: true },
    });

    const ldb = (tenant?.lockedDbIds as Record<string, string>) || {};
    const dbExpenses = getLockedDbId('db-expenses', ldb);

    const db = await prisma.globalDatabase.findUnique({
        where: { id: dbExpenses },
        select: { id: true, tenantId: true },
    });

    let purchases: { id: string; title: string; supplier: string; amount: number; date: string; status: string }[] = [];

    if (db && db.tenantId === tenantId) {
        const pages = await prisma.globalPage.findMany({
            where: { databaseId: dbExpenses },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: { id: true, properties: true, createdAt: true },
        });

        purchases = pages.map(p => {
            const props = p.properties as Record<string, any>;
            return {
                id: p.id,
                title: String(props['title'] || 'Unnamed Invoice'),
                supplier: String(props['supplierName'] || 'Unknown Supplier'),
                amount: Number(props['totalIncVat'] ?? props['total'] ?? props['amount'] ?? 0),
                date: String(props['invoiceDate'] || props['date'] || p.createdAt.toISOString().split('T')[0]),
                status: String(props['status'] || 'opt-draft'),
            };
        });
    }

    const planType = tenant?.planType || 'FREE';
    const limit = planType === 'FREE' ? 10 : planType === 'PRO' ? 30 : 'Unlimited';

    return (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black tracking-tight">{t('pur_title')}</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{t('pur_subtitle')}</p>
                </div>
            </div>

            {/* Plan Info Card */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-3.5 flex items-start gap-3">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{t('pur_peppol_active')}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1 leading-relaxed">
                        {t('pur_peppol_desc', { plan: planType, limit })}
                    </p>
                </div>
            </div>

            {/* List */}
            {purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <Receipt className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500">{t('pur_empty_title')}</p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">
                        {t('pur_empty_desc')}
                    </p>
                </div>
            ) : (
                <div className="space-y-2 pb-2">
                    {purchases.map(inv => {
                        const isUnpaid = inv.status !== 'opt-paid';
                        return (
                            <div
                                key={inv.id}
                                className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                            <Building2 className="w-4 h-4 text-neutral-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold leading-tight">{inv.supplier}</p>
                                            <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {inv.date}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-black text-neutral-800 dark:text-neutral-200">
                                        €{inv.amount.toLocaleString(locale, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between border-t border-dashed border-neutral-100 dark:border-white/5 pt-2 mt-2">
                                    <p className="text-[9px] text-neutral-400 truncate max-w-[150px]">{inv.title}</p>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${
                                        isUnpaid ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                                    }`}>
                                        {isUnpaid ? <AlertCircle className="w-3 h-3" /> : null}
                                        {isUnpaid ? 'To Pay' : 'Paid'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
