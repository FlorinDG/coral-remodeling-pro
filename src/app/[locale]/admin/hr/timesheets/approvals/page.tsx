"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { hrList, hrUpdate } from '@/components/time-tracker/lib/hr-api';
import { formatWorkDuration, computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Check, X, AlertTriangle } from 'lucide-react';

export default function TimesheetApprovalsPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const data = await hrList<any>('clock-entries');
            // Filter pending entries locally (in a real app, pass filter to API)
            const pending = data.filter(e => e.approvalStatus !== 'approved' && e.clockOutTime);
            setEntries(pending.sort((a, b) => new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime()));
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
        <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Goedkeuringen</h1>
                    <p className="text-sm text-neutral-500 mt-1">Urenregistratie wachtend op goedkeuring</p>
                </div>
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-medium">
                    {entries.length} openstaand
                </div>
            </div>

            <div className="space-y-4">
                {entries.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center text-neutral-500">
                            <Check className="w-12 h-12 mx-auto text-green-500 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Helemaal bijgewerkt</p>
                            <p className="text-sm mt-1">Er zijn geen uren die wachten op goedkeuring.</p>
                        </CardContent>
                    </Card>
                ) : (
                    entries.map(entry => {
                        const duration = computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak || false);
                        const durationStr = formatWorkDuration(duration);
                        
                        return (
                            <Card key={entry.id} className="overflow-hidden">
                                <div className="flex items-stretch">
                                    <div className="w-1 bg-amber-400 shrink-0" />
                                    <div className="flex-1 p-5 flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-neutral-900 dark:text-white">
                                                    {entry.userName || 'System'}
                                                </span>
                                                <span className="text-xs text-neutral-500 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 rounded-full">
                                                    {format(new Date(entry.clockInTime), 'dd MMM yyyy', { locale: nl })}
                                                </span>
                                            </div>
                                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                                {format(new Date(entry.clockInTime), 'HH:mm')} - {format(new Date(entry.clockOutTime), 'HH:mm')}
                                                <span className="mx-2">•</span>
                                                <span className="font-medium text-neutral-900 dark:text-neutral-100">{durationStr}</span>
                                                {duration.breakDeducted && (
                                                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                        -30m pauze
                                                    </span>
                                                )}
                                            </div>
                                            {entry.taskDescription && (
                                                <p className="text-sm mt-2 text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded border border-neutral-100 dark:border-neutral-800">
                                                    "{entry.taskDescription}"
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-neutral-100 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6">
                                            <button 
                                                onClick={() => handleDeny(entry.id)}
                                                className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors"
                                                title="Afkeuren"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(entry.id)}
                                                className="flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 transition-colors"
                                                title="Goedkeuren"
                                            >
                                                <Check className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
