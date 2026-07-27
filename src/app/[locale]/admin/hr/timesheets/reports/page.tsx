"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { hrList } from '@/components/time-tracker/lib/hr-api';
import { formatWorkDuration } from '@/lib/computeWorkedDuration';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { nl } from 'date-fns/locale';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { Download, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RateRestampFlyout } from './RateRestampFlyout';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { TimesheetPDF } from './TimesheetPDF';

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

    // Restamp Flyout State
    const [restampOpen, setRestampOpen] = useState(false);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedWorkerName, setSelectedWorkerName] = useState('');
    const [selectedWorkerRate, setSelectedWorkerRate] = useState<number | null>(null);

    const fetchReport = async () => {
            setLoading(true);
            try {
                let url = '/api/hr/timesheet-reports';
                
                if (dateRange !== 'all') {
                    const now = new Date();
                    let from: Date, to: Date;
                    
                    switch (dateRange) {
                        case 'thisWeek':
                            from = startOfWeek(now, { weekStartsOn: 1 });
                            to = endOfWeek(now, { weekStartsOn: 1 });
                            break;
                        case 'lastWeek':
                            const lastW = subWeeks(now, 1);
                            from = startOfWeek(lastW, { weekStartsOn: 1 });
                            to = endOfWeek(lastW, { weekStartsOn: 1 });
                            break;
                        case 'thisMonth':
                            from = startOfMonth(now);
                            to = endOfMonth(now);
                            break;
                        case 'lastMonth':
                            const lastM = subMonths(now, 1);
                            from = startOfMonth(lastM);
                            to = endOfMonth(lastM);
                            break;
                        default:
                            from = startOfMonth(now);
                            to = endOfMonth(now);
                    }
                    url += `?from=${from.toISOString()}&to=${to.toISOString()}`;
                }
                
                const response = await fetch(url);
                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error("Failed to fetch reports:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();

        const handleRefetch = () => fetchReport();
        window.addEventListener('refetch-reports', handleRefetch);
        return () => window.removeEventListener('refetch-reports', handleRefetch);
    }, [dateRange]);

    const handleOpenRestamp = (workerId: string, workerName: string, currentRate: number | null) => {
        setSelectedWorkerId(workerId);
        setSelectedWorkerName(workerName);
        setSelectedWorkerRate(currentRate);
        setRestampOpen(true);
    };

    if (loading) {
        return <div className="p-8 text-center text-neutral-500">Loading reports...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-red-500">Failed to load reports.</div>;
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="p-6 space-y-6 max-w-[1400px] mx-auto w-full">
                <div className="flex justify-between items-center">
                    <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Rapportages</h1>
                    <p className="text-sm text-neutral-500 mt-1">Geregistreerde uren en kosten</p>
                </div>
                <div className="flex items-center space-x-3">
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

                    {data && data.entries && (
                        <PDFDownloadLink
                            document={<TimesheetPDF reportData={data} dateRangeLabel={dateRange} />}
                            fileName={`werkbon_${dateRange}.pdf`}
                        >
                            {({ loading: pdfLoading }) => (
                                <Button variant="outline" size="sm" disabled={pdfLoading} className="h-[38px]">
                                    <Download className="w-4 h-4 mr-2" />
                                    {pdfLoading ? 'Loading...' : 'PDF Export'}
                                </Button>
                            )}
                        </PDFDownloadLink>
                    )}
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
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="pb-2 font-medium">Medewerker</th>
                                    <th className="pb-2 font-medium text-right">Totaal Uren</th>
                                    <th className="pb-2 font-medium text-right">Factureerbaar</th>
                                    <th className="pb-2 font-medium text-right">Acties</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.rollups.byWorker.map((worker: any) => (
                                    <tr key={worker.userId}>
                                        <td className="py-3">{worker.workerName}</td>
                                        <td className="py-3 text-right">{formatWorkDuration({ totalMinutes: worker.hours * 60 } as any)}</td>
                                        <td className="py-3 text-right">{formatWorkDuration({ totalMinutes: worker.billableHours * 60 } as any)}</td>
                                        <td className="py-3 text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleOpenRestamp(worker.userId, worker.workerName, null)}
                                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            >
                                                <Edit2 className="w-3 h-3 mr-1" /> Tarief
                                            </Button>
                                        </td>
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
            
            <RateRestampFlyout 
                open={restampOpen}
                onOpenChange={setRestampOpen}
                workerId={selectedWorkerId}
                workerName={selectedWorkerName}
                currentRate={selectedWorkerRate}
                onSuccess={() => {
                    // Refetch the report to see the new rates take effect
                    const ev = new CustomEvent('refetch-reports');
                    window.dispatchEvent(ev);
                }}
            />
        </div>
    );
}
