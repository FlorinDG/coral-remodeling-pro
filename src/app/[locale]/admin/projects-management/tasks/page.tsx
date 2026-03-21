import prisma from "@/lib/prisma";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";
import { FolderKanban, Plus, Clock, Euro, ArrowRight, Activity } from "lucide-react";

export default async function InternalProjectsPage() {
    const projects = await prisma.internalProject.findMany({
        orderBy: { startDate: 'desc' }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Internal Projects Hub</h1>
                        <p className="text-neutral-500 font-medium text-sm mt-1">Central database for operational tracking, project lifecycles, and internal budgets.</p>
                    </div>
                    <button className="flex items-center gap-2 bg-[#d35400] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#e67e22] transition-colors">
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>

                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {projects.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <FolderKanban className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No Projects Registered</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">Create an internal operational project to track workforce costing, supplier materials, and operational scheduling.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Project ID & Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Timeline</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Internal Budget</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map((proj) => (
                                        <tr key={proj.id} className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400">
                                                        <Activity className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-sm text-neutral-900 dark:text-white block">{proj.name}</span>
                                                        <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">{proj.projectCode}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                                                    ${proj.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20' :
                                                        proj.status === 'PLANNING' ? 'bg-orange-100 text-orange-700 dark:bg-[#d35400]/10 dark:text-[#d35400] border-orange-200 dark:border-[#d35400]/20' :
                                                            proj.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' :
                                                                'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'}`}>
                                                    {proj.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                                {proj.startDate ? (
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3 h-3 text-neutral-400" />
                                                        <span>{new Date(proj.startDate).toLocaleDateString()}</span>
                                                        <ArrowRight className="w-3 h-3 text-neutral-300" />
                                                        <span>{proj.targetEndDate ? new Date(proj.targetEndDate).toLocaleDateString() : 'TBD'}</span>
                                                    </div>
                                                ) : <span className="italic text-neutral-400">No dates set</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 font-mono text-sm font-bold text-neutral-900 dark:text-white">
                                                    <Euro className="w-3 h-3 text-neutral-400" />
                                                    {(proj.budget || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-[#d35400] text-sm font-bold hover:underline">Open Hub</button>
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
