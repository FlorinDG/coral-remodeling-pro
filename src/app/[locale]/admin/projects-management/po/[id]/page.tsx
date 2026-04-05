"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, Printer, ShoppingCart, Package } from 'lucide-react';

export default function PurchaseOrderPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));
        setIsHydrated(useDatabaseStore.persist?.hasHydrated() || false);
    }, []);

    const project = useDatabaseStore(state => {
        return state.databases.find(d => d.id === 'db-1')?.pages.find(p => p.id === id) || null;
    });

    const allTasks = useDatabaseStore(state => state.databases.find(d => d.id === 'db-tasks')?.pages || []);

    const tasks = React.useMemo(() => {
        return allTasks.filter(p => {
            const linkedProjects = p.properties['prop-task-project'] as string[];
            return Array.isArray(linkedProjects) && linkedProjects.includes(id);
        });
    }, [allTasks, id]);

    if (!isHydrated) return <div className="flex h-screen items-center justify-center font-mono text-sm text-neutral-500">Loading Purchase Order...</div>;
    if (!project) return <div className="flex h-screen items-center justify-center flex-col gap-4"><h1>Project Not Found</h1><button onClick={() => router.back()} className="text-blue-500 underline">Go Back</button></div>;

    const projectTitle = String(project.properties['title'] || 'Unnamed Project');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-neutral-100 dark:bg-[#0p0p0p] text-neutral-900 dark:text-white pb-24">
            {/* Non-printable Header Controls */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-[#111] border-b border-neutral-200 dark:border-white/10 shrink-0 print:hidden">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-md transition-colors">
                        <ArrowLeft className="w-5 h-5 text-neutral-500" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">Bestelbon / Purchase Order</h1>
                        <p className="text-xs text-neutral-500 font-mono tracking-wider">{id}</p>
                    </div>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold shadow-sm hover:opacity-80 transition-opacity"
                >
                    <Printer className="w-4 h-4" /> Export PO to PDF
                </button>
            </div>

            {/* Printable A4 Canvas */}
            <div className="w-full max-w-[210mm] mx-auto mt-8 bg-white text-black shadow-lg print:shadow-none print:mt-0 A4-page">
                <div className="p-[20mm]">

                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tight">Bestelbon</h1>
                            <h2 className="text-xl font-bold text-neutral-600 mt-1">Materiaal Aanvraag (PO)</h2>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-sm uppercase tracking-widest text-neutral-500 mb-1">Levering via Project</p>
                            <p className="text-lg font-bold">{projectTitle}</p>
                            <p className="text-sm font-mono mt-2 text-neutral-500">Aanvraagdatum: {new Date().toLocaleDateString('nl-BE')}</p>
                        </div>
                    </div>

                    {/* Notice Block */}
                    <div className="bg-blue-50 p-4 border-l-4 border-blue-500 mb-8 flex items-start gap-3">
                        <ShoppingCart className="w-6 h-6 shrink-0 mt-0.5 text-blue-600" />
                        <div>
                            <p className="text-sm font-bold text-blue-900">Aanvraag voor Leverancier</p>
                            <p className="text-xs text-blue-800 mt-1">Gelieve de onderstaande materialen te reserveren/leveren voor dit project. Contacteer onze werfleider voor specifieke leveringsdatums.</p>
                        </div>
                    </div>

                    {/* Materials Table */}
                    <h3 className="text-lg font-bold border-b border-black pb-2 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" /> Vereiste Materialen / Producten
                    </h3>

                    <div className="border border-black">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-black bg-neutral-100">
                                    <th className="p-3 text-xs font-bold uppercase tracking-wider w-16 text-center border-r border-black">Aant.</th>
                                    <th className="p-3 text-xs font-bold uppercase tracking-wider">Product Omschrijving / Referentie</th>
                                    <th className="p-3 text-xs font-bold uppercase tracking-wider w-32 border-l border-black">Opmerking</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-sm font-medium text-neutral-500 italic">Geen artikelen gespecificeerd voor aankoop.</td>
                                    </tr>
                                ) : (
                                    tasks.map((task, index) => (
                                        <tr key={task.id} className="border-b border-neutral-300 last:border-0">
                                            <td className="p-3 border-r border-black font-mono text-center">—</td>
                                            <td className="p-3 font-medium text-sm">
                                                {String(task.properties['title'] || 'Unnamed Item')}
                                            </td>
                                            <td className="p-3 border-l border-black">
                                                {/* Empty space for specs */}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Signatures */}
                    <div className="mt-16 grid grid-cols-2 gap-12">
                        <div className="border-t border-black pt-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-center">Inkoop Verantwoordelijke</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-center">Akkoord Leverancier</p>
                        </div>
                    </div>

                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4; margin: 0; }
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:mt-0 { margin-top: 0 !important; }
                    .A4-page { width: 100%; height: 100%; max-width: none; }
                }
            `}} />
        </div>
    );
}
