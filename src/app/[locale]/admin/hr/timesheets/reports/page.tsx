"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { hrList } from '@/components/time-tracker/lib/hr-api';
import { formatWorkDuration } from '@/lib/computeWorkedDuration';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface ReportSummary {
    totalHours: number;
    billableHours: number;
    internalHours: number;
    approvedHours: number;
    pendingHours: number;
    openEntries: number;
}

interface WorkerRollup {
    userId: string;
    workerName: string;
    hours: number;
    billableHours: number;
}

interface ReportData {
    entries: any[];
    rollups: {
        byWorker: WorkerRollup[];
        byProject: any[];
        byWorkerProject: any[];
        byDay: any[];
    };
    summary: ReportSummary;
}

export default function TimesheetReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [dateRange, setDateRange] = useState('thisMonth');

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                // In a real app we'd build the query string. Hardcoded to last 30 days for now.
                const from = new Date();
                from.setDate(from.getDate() - 30);
                const to = new Date();
                
                const response = await fetch(`/api/hr/timesheet-reports?from=${from.toISOString()}&to=${to.toISOString()}`);
                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error("Failed to fetch reports:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [dateRange]);

    if (loading) {
        return <div className="p-8 text-center text-neutral-500">Loading reports...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-red-500">Failed to load reports.</div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Rapportages</h1>
                    <p className="text-sm text-neutral-500 mt-1">Geregistreerde uren en kosten</p>
                </div>
                <div className="flex items-center space-x-2">
                    <select 
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-2 border rounded-md text-sm bg-white dark:bg-neutral-800 dark:border-neutral-700"
                    >
                        <option value="thisWeek">Deze week</option>
                        <option value="lastWeek">Vorige week</option>
                        <option value="thisMonth">Deze maand</option>
                        <option value="lastMonth">Vorige maand</option>
                        <option value="all">Alle tijd</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-500">Totaal Uren</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.totalHours.toFixed(1)}u</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-500">Facturabel</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{data.summary.billableHours.toFixed(1)}u</div>
                        <div className="text-xs text-neutral-500 mt-1">vs {data.summary.internalHours.toFixed(1)}u intern</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-500">Goedgekeurd</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{data.summary.approvedHours.toFixed(1)}u</div>
                        <div className="text-xs text-neutral-500 mt-1">vs {data.summary.pendingHours.toFixed(1)}u in afwachting</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-500">Openstaande shifts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{data.summary.openEntries}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Per Medewerker</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500">
                                <tr>
                                    <th className="px-4 py-3 font-medium rounded-l-lg">Medewerker</th>
                                    <th className="px-4 py-3 font-medium">Totaal Uren</th>
                                    <th className="px-4 py-3 font-medium">Facturabel</th>
                                    <th className="px-4 py-3 font-medium rounded-r-lg">Intern</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {data.rollups.byWorker.map((worker) => (
                                    <tr key={worker.userId} className="hover:bg-neutral-50/50 dark:hover:bg-white/[0.02]">
                                        <td className="px-4 py-3 font-medium">{worker.workerName}</td>
                                        <td className="px-4 py-3">{worker.hours.toFixed(1)}u</td>
                                        <td className="px-4 py-3 text-green-600">{worker.billableHours.toFixed(1)}u</td>
                                        <td className="px-4 py-3 text-neutral-500">{(worker.hours - worker.billableHours).toFixed(1)}u</td>
                                    </tr>
                                ))}
                                {data.rollups.byWorker.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">Geen data gevonden voor deze periode.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
