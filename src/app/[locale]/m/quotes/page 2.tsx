/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { getLockedDbId } from "@/lib/lockedDbUtils";
import { Link } from "@/i18n/routing";
import { FileSignature, Plus, Clock, CheckCircle, Send, AlertTriangle } from "lucide-react";
import { getTranslations } from 'next-intl/server';

function getQuoteStatus(status: string) {
    switch (status) {
        case 'opt-draft':    return { label: 'Draft',    color: 'bg-neutral-100 dark:bg-white/10 text-neutral-500', icon: Clock };
        case 'opt-sent':     return { label: 'Sent',     color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Send };
        case 'opt-accepted': return { label: 'Accepted', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle };
        case 'opt-declined': return { label: 'Declined', color: 'bg-red-50 dark:bg-red-500/10 text-red-500', icon: AlertTriangle };
        case 'opt-expired':  return { label: 'Expired',  color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600', icon: AlertTriangle };
        default:             return { label: status.replace('opt-', ''), color: 'bg-neutral-100 text-neutral-500', icon: Clock };
    }
}

export default async function MobileQuotesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('Mobile');
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) return <div className="p-12 text-center text-sm text-neutral-500">Session expired.</div>;

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true },
    });

    const ldb = (tenant?.lockedDbIds as Record<string, string>) || {};
    const dbQuotations = getLockedDbId('db-quotations', ldb);

    const db = await prisma.globalDatabase.findUnique({
        where: { id: dbQuotations },
        select: { id: true, tenantId: true },
    });

    let quotes: { id: string; title: string; client: string; status: string; amount: number; createdAt: Date }[] = [];

    if (db && db.tenantId === tenantId) {
        const pages = await prisma.globalPage.findMany({
            where: { databaseId: dbQuotations },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: { id: true, properties: true, createdAt: true },
        });

        quotes = pages.map(p => {
            const props = p.properties as Record<string, any>;
            return {
                id: p.id,
                title: String(props['title'] || props['quoteNumber'] || 'Untitled Quote'),
                client: String(props['clientName'] || props['client'] || '—'),
                status: String(props['status'] || 'opt-draft'),
                amount: Number(props['totalIncVat'] ?? props['total'] ?? props['amount'] ?? 0),
                createdAt: p.createdAt,
            };
        });
    }

    return (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black tracking-tight">{t('quotes_title')}</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{t('quotes_subtitle')}</p>
                </div>
                <Link
                    href="/admin/quotations"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold shadow-sm active:scale-[0.97] transition-all"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    <Plus className="w-3.5 h-3.5" />
                    {t('quotes_new')}
                </Link>
            </div>

            {/* Quotes list */}
            {quotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <FileSignature className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500">{t('quotes_empty_title')}</p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">{t('quotes_empty_desc')}</p>
                    <Link
                        href="/admin/quotations"
                        className="mt-4 px-4 py-2 rounded-xl text-white text-sm font-bold active:scale-[0.97] transition-all"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        {t('quotes_new')}
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    {quotes.map(q => {
                        const s = getQuoteStatus(q.status);
                        const StatusIcon = s.icon;
                        return (
                            <Link
                                key={q.id}
                                href={`/admin/quotations/${q.id}`}
                                className="flex items-center justify-between p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-white/5 shadow-sm hover:border-purple-300/40 transition-all active:scale-[0.99] group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                                        <FileSignature className="w-4 h-4 text-purple-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold truncate">{q.title}</p>
                                        <p className="text-[10px] text-neutral-500 truncate">{q.client}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm font-black text-neutral-700 dark:text-neutral-300">
                                        {q.amount > 0 ? `€${q.amount.toLocaleString(locale, { minimumFractionDigits: 2 })}` : '—'}
                                    </span>
                                    <span className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-widest ${s.color}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {s.label}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
