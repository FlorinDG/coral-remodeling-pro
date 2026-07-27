"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { hrList, hrUpdate } from '@/components/time-tracker/lib/hr-api';
import { formatWorkDuration, computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Check, X, AlertTriangle } from 'lucide-react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";

export default function TimesheetApprovalsPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const data = await hrList<any>('clock-entries');
            // Filter pending entries locally (in a real app, pass filter to API)
            const pending = data.filter(e => e.approvalStatus !== 'approved' && e.clockOutTime);
            setEntries(pending.sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())); // Most recent on top
        } catch (err) {
            console.error("Failed to fetch pending entries:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleApprove = async (id: string) => {
        try {
            await hrUpdate('clock-entries', id, { approvalStatus: 'approved' });
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Approval failed:", err);
        }
    };

    const handleDeny = async (id: string) => {
        try {
            await hrUpdate('clock-entries', id, { approvalStatus: 'denied' });
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Denial failed:", err);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-neutral-500">Loading queue...</div>;
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="p-6 space-y-6 max-w-[1400px] mx-auto w-full">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Goedkeuringen</h1>
                        <p className="text-sm text-neutral-500 mt-1">Urenregistratie wachtend op goedkeuring</p>
                    </div>
                    <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-medium">
                        {entries.length} openstaand
                    </div>
                </div>

                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {entries.length === 0 ? (
                        <div className="p-12 text-center text-neutral-500">
                            <Check className="w-12 h-12 mx-auto text-green-500 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Helemaal bijgewerkt</p>
                            <p className="text-sm mt-1">Er zijn geen uren die wachten op goedkeuring.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Datum</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Medewerker</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Duur</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Project / Details</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500 text-right">Acties</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                {entries.map(entry => {
                                    const start = new Date(entry.clockInTime);
                                    const end = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
                                    const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
                                    const durationStr = formatWorkDuration(duration);
                                    
                                    return (
                                        <tr key={entry.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                                                        {format(start, 'dd MMM yyyy', { locale: nl })}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-400">
                                                        {format(start, 'HH:mm')} - {end ? format(end, 'HH:mm') : '...'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                                    {entry.userName || 'System'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-neutral-600 dark:text-neutral-400">
                                                        {durationStr}
                                                    </span>
                                                    {duration.breakDeducted && (
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded" title="Pauze automatisch afgetrokken (>4u)">
                                                            -30m pauze
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="flex flex-col gap-1">
                                                    {entry.projectId && (
                                                        <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md inline-flex self-start">
                                                            Project: {entry.projectId}
                                                        </span>
                                                    )}
                                                    <p className="text-xs text-neutral-500 truncate" title={entry.taskDescription || ''}>
                                                        {entry.taskDescription || <span className="italic opacity-50">Geen omschrijving</span>}
                                                    </p>
                                                    {entry.requiresApproval && (
                                                        <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Handmatige invoer
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleDeny(entry.id)}
                                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Afkeuren"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(entry.id)}
                                                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                        title="Goedkeuren"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
