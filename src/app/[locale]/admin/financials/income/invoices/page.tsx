import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "@/config/tabs";
import { FileText, Plus, Calendar, CheckCircle, AlertCircle, Clock } from "lucide-react";

import { Link } from "@/i18n/routing";
import CreateInvoiceButton from "@/components/admin/invoices/CreateInvoiceButton";
import InvoiceActionDropdown from "@/components/admin/invoices/InvoiceActionDropdown";
import InvoiceTotalCell from "@/components/admin/invoices/InvoiceTotalCell";
import { auth } from "@/auth";

export default async function SalesInvoicesPage() {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    if (!tenantId) {
        return <div className="p-12 text-center text-red-500 font-bold">Unauthorized. Tenant context missing.</div>;
    }

    const invoices = await prisma.invoice.findMany({
        where: { type: 'SALES', tenantId },
        orderBy: { issueDate: 'desc' },
        include: {}
    });

    return (
        <div className="flex flex-col w-full h-full">
            <div className="relative">
                <ModuleTabs tabs={financialTabs} groupId="financials" />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20">
                    <CreateInvoiceButton />
                </div>
            </div>
            <div className="w-full h-full flex flex-col hide-scrollbar overflow-y-auto">
                <div className="bg-white dark:bg-black border-b border-neutral-200 dark:border-white/10 flex-1">
                    {invoices.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <FileText className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No Sales Invoices Generated</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">Draft your first invoice line-item to establish accounts receivable tracking and VAT logging.</p>
                        </div>
                    ) : (
                        <div>
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Invoice #</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Client ID</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Timeline</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Incl. VAT</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv) => (
                                        <tr key={inv.id} className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={`/admin/financials/income/invoices/${inv.id}`}
                                                    className="flex items-center gap-3 group"
                                                >
                                                    <div
                                                        className="p-2 rounded-lg border"
                                                        style={{ borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 20%, transparent)', color: 'var(--brand-color, #d35400)' }}
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold font-mono text-sm tracking-widest text-neutral-900 dark:text-white group-hover:underline transition-colors" style={{ textDecorationColor: 'var(--brand-color, #d35400)' }}>
                                                        {inv.invoiceNumber}
                                                    </span>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                                    {inv.contactId ? inv.contactId : <span className="italic text-neutral-400 text-xs">Unassigned</span>}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                                                    <Calendar className="w-3 h-3 block" />
                                                    Issued: {new Date(inv.issueDate).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider" style={{ color: 'var(--brand-color, #d35400)' }}>
                                                    <Clock className="w-3 h-3" />
                                                    Due: {new Date(inv.dueDate).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <InvoiceTotalCell
                                                    invoiceId={inv.id}
                                                    fallbackTotal={inv.total}
                                                    fallbackVat={inv.vatTotal}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 flex items-center gap-1.5 w-max rounded-full text-[10px] font-bold uppercase tracking-wider border
                                                    ${inv.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20' :
                                                        inv.status === 'SENT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' :
                                                            inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20' :
                                                                'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'}`}>

                                                    {inv.status === 'PAID' ? <CheckCircle className="w-3 h-3" /> : inv.status === 'OVERDUE' ? <AlertCircle className="w-3 h-3" /> : null}
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <InvoiceActionDropdown invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
