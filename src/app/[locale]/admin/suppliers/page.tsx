import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";
import { Truck, Plus, Mail, Phone, MapPin, Building2, Tag } from "lucide-react";

export default async function SuppliersPage() {
    const suppliers = await prisma.supplier.findMany({
        orderBy: { companyName: 'asc' }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Leveranciers (Suppliers)</h1>
                        <p className="text-neutral-500 font-medium text-sm mt-1">Manage your material providers, subcontractors, and core logistics partners.</p>
                    </div>
                    <button className="flex items-center gap-2 bg-[#d35400] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#e67e22] transition-colors">
                        <Plus className="w-4 h-4" />
                        Add Supplier
                    </button>
                </div>

                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {suppliers.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Truck className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No Suppliers Found</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">Register your first B2B supplier to enable purchase invoice tracking and material logistics.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Company</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Details</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Address</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((sup) => (
                                        <tr key={sup.id} className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-[#d35400]/10 dark:bg-[#e67e22]/20 flex items-center justify-center text-[#d35400] dark:text-[#e67e22] font-bold text-xs uppercase">
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-sm text-neutral-900 dark:text-white block">{sup.companyName}</span>
                                                        {sup.vatNumber && <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest">{sup.vatNumber}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 space-y-1">
                                                {sup.contactPerson && <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{sup.contactPerson}</div>}
                                                {sup.email && <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-medium"><Mail className="w-3 h-3" /> {sup.email}</div>}
                                                {sup.phone && <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-medium"><Phone className="w-3 h-3" /> {sup.phone}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-neutral-500 font-medium space-y-1">
                                                {sup.address && <div className="flex items-start gap-2"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {sup.address}</div>}
                                                {sup.town && <div className="pl-5 text-[10px] uppercase tracking-wider">{sup.town}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {sup.category ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300 border border-neutral-200 dark:border-white/5 flex items-center gap-1">
                                                            <Tag className="w-3 h-3" />
                                                            {sup.category}
                                                        </span>
                                                    </div>
                                                ) : <span className="text-neutral-400 text-xs italic">Uncategorized</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-[#d35400] text-sm font-bold hover:underline">Manage</button>
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
