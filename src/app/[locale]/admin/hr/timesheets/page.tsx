"use client";

import React, { useEffect, useState } from 'react';
import { hrList } from '@/components/time-tracker/lib/hr-api';
import { Loader2, FileText, Download, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Link } from '@/i18n/routing';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    [key: string]: unknown;
}

interface ClockEntry {
    id: string;
    userId: string;
    clockInTime: string;
    clockOutTime: string | null;
    taskDescription: string | null;
    approvalStatus: string | null;
    photos: string[] | null;
    user?: Employee;
}

export default function TimesheetsPage() {
    const [entries, setEntries] = useState<ClockEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [entriesData, employeesData] = await Promise.all([
                    hrList<ClockEntry>('clock-entries'),
                    hrList<Employee>('employees')
                ]);

                const employeeMap = new Map(employeesData.map((e) => [e.id, e]));
                
                const enriched = entriesData.map(e => ({
                    ...e,
                    user: employeeMap.get(e.userId)
                })).filter(e => !!e.clockOutTime); // Only show completed timesheets

                setEntries(enriched);
            } catch (err) {
                console.error('Failed to fetch timesheets:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-neutral-500 mt-4">Laden van werkbonnen...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Timesheets / Werkbonnen</h1>
                    <p className="text-sm text-neutral-500">Overview of completed work entries and generated reports.</p>
                </div>
            </header>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Datum</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Medewerker</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Duur</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Omschrijving</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Media</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500 text-right">Acties</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                        {entries.map(entry => {
                            const start = new Date(entry.clockInTime);
                            const end = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
                            const durationMs = end ? end.getTime() - start.getTime() : 0;
                            const durationHrs = Math.floor(durationMs / (1000 * 60 * 60));
                            const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            const photoCount = Array.isArray(entry.photos) ? entry.photos.length : 0;

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
                                            {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-mono text-neutral-600 dark:text-neutral-400">
                                            {durationHrs}u {durationMins}m
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <p className="text-xs text-neutral-500 truncate" title={entry.taskDescription || ''}>
                                            {entry.taskDescription || <span className="italic opacity-50">Geen omschrijving</span>}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {photoCount > 0 ? (
                                            <div className="flex items-center gap-1.5 text-blue-500">
                                                <ImageIcon className="w-3.5 h-3.5" />
                                                <span className="text-xs font-bold">{photoCount}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-neutral-300">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/hr/timesheets/${entry.id}`}>
                                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                                                    <FileText className="w-3.5 h-3.5" />
                                                    Bekijk Werkbon
                                                </Button>
                                            </Link>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-orange-500">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {entries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <AlertCircle className="w-12 h-12 text-neutral-200 mb-4" />
                        <p className="text-neutral-400">Nog geen voltooide werkbonnen gevonden.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
