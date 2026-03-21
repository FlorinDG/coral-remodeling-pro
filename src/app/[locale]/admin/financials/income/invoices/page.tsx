import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "@/config/tabs";
import { FileText, Plus, Euro, Calendar, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default async function SalesInvoicesPage() {
    const invoices = await prisma.invoice.findMany({
        where: { type: 'SALES' },
        orderBy: { issueDate: 'desc' },
        include: {
            // Optional: when relations are mapped to real contacts, this will join them
            // contact: true 
        }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} groupId="financials" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Verkoopfacturen (Sales Invoices)</h1>
                        <p className="text-neutral-500 font-medium text-sm mt-1">Manage accounts receivable, track payments, and generate PDF invoices.</p>
                    </div>
                    <button className="flex items-center gap-2 bg-[#d35400] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#e67e22] transition-colors">
                        <Plus className="w-4 h-4" />
                        Create Invoice
                    </button>
                </div>

                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {invoices.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <FileText className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No Sales Invoices Generated</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">Draft your first invoice line-item to establish accounts receivable tracking and VAT logging.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
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
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-[#d35400]/10 dark:bg-[#e67e22]/20 border border-[#d35400]/20 text-[#d35400] dark:text-[#e67e22]">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold font-mono text-sm tracking-widest text-neutral-900 dark:text-white">{inv.invoiceNumber}</span>
                                                </div>
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
                                                <div className="flex items-center gap-2 text-[11px] text-[#d35400] font-bold tracking-wider">
                                                    <Clock className="w-3 h-3" />
                                                    Due: {new Date(inv.dueDate).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 font-mono text-sm font-bold text-neutral-900 dark:text-white">
                                                    <Euro className="w-3 h-3 text-neutral-400" />
                                                    {inv.total.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                </div>
                                                <div className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">
                                                    {inv.vatTotal.toLocaleString('nl-BE', { minimumFractionDigits: 2 })} VAT
                                                </div>
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
                                                <button className="text-[#d35400] text-sm font-bold hover:underline">View PDF</button>
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
