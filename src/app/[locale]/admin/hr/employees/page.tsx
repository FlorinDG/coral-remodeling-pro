import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { Users, Plus, Mail, Phone, Briefcase } from "lucide-react";

export default async function EmployeesPage() {
    const employees = await prisma.employee.findMany({
        orderBy: { lastName: 'asc' }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Employee Directory</h1>
                        <p className="text-neutral-500 font-medium text-sm mt-1">Manage personnel, roles, and internal billing rates.</p>
                    </div>
                    <button className="flex items-center gap-2 bg-[#d35400] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#e67e22] transition-colors">
                        <Plus className="w-4 h-4" />
                        Add Employee
                    </button>
                </div>

                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {employees.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Users className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No Employees Found</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">Get started by adding your first team member to enable workforce scheduling and time tracking.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map((emp) => (
                                        <tr key={emp.id} className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-xs uppercase">
                                                        {emp.firstName[0]}{emp.lastName[0]}
                                                    </div>
                                                    <span className="font-medium text-sm text-neutral-900 dark:text-white">{emp.firstName} {emp.lastName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium"><Mail className="w-3 h-3" /> {emp.email}</div>
                                                {emp.phone && <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium"><Phone className="w-3 h-3" /> {emp.phone}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                                                    <Briefcase className="w-4 h-4 text-neutral-400" />
                                                    {emp.role}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'}`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-[#d35400] text-sm font-bold hover:underline">Edit</button>
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
