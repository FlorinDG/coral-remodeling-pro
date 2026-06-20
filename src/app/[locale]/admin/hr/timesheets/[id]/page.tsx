"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { hrList } from '@/components/time-tracker/lib/hr-api';
import { Loader2, ArrowLeft, Printer, Download, Clock, Calendar, User, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Link } from '@/i18n/routing';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    [key: string]: unknown;
}

interface ErpProject {
    id: string;
    name: string;
    projectCode: string;
}

interface ClockEntry {
    id: string;
    userId: string;
    clockInTime: string;
    clockOutTime: string | null;
    clockInLatitude: number | null;
    clockInLongitude: number | null;
    clockOutLatitude: number | null;
    clockOutLongitude: number | null;
    taskDescription: string | null;
    approvalStatus: string | null;
    photos: string[];
    noBreak: boolean;
    user?: Employee;
    project?: ErpProject | null;
}

export default function WerkbonDetailPage() {
    const params = useParams();
    const id = params.id as string;
    
    const [entry, setEntry] = useState<ClockEntry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // In a real app, we'd have a get-by-id endpoint, but here we'll filter the list
                const [entriesData, employeesData] = await Promise.all([
                    hrList<ClockEntry>('clock-entries'),
                    hrList<Employee>('employees')
                ]);

                const rawEntry = entriesData.find(e => e.id === id);
                if (rawEntry) {
                    const employee = employeesData.find((e) => e.id === rawEntry.userId);
                    // Find project if linked via shift
                    // For now we'll assume it's just the raw entry
                    setEntry({
                        ...rawEntry,
                        user: employee,
                        photos: Array.isArray(rawEntry.photos) ? rawEntry.photos : []
                    });
                }
            } catch (err) {
                console.error('Failed to fetch werkbon:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-neutral-100 dark:bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-neutral-500 mt-4">Werkbon genereren...</p>
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p>Werkbon niet gevonden.</p>
                <Link href="/admin/hr/timesheets">
                    <Button variant="link">Terug naar overzicht</Button>
                </Link>
            </div>
        );
    }

    const start = new Date(entry.clockInTime);
    const end = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
    const durationMs = end ? end.getTime() - start.getTime() : 0;
    const durationHrs = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return (
        <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 p-4 md:p-8 flex flex-col items-center">
            {/* Toolbar */}
            <div className="w-full max-w-[210mm] mb-6 flex items-center justify-between no-print">
                <Link href="/admin/hr/timesheets">
                    <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Terug
                    </Button>
                </Link>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> Print
                    </Button>
                    <Button variant="default" size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600">
                        <Download className="w-4 h-4" /> Export PDF
                    </Button>
                </div>
            </div>

            {/* A4 Document */}
            <div className="w-full max-w-[210mm] bg-white dark:bg-neutral-900 shadow-2xl rounded-sm min-h-[297mm] p-[20mm] flex flex-col print:shadow-none print:m-0 print:rounded-none">
                {/* Header */}
                <header className="flex justify-between items-start border-b-2 border-orange-500 pb-8 mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-neutral-900 dark:text-white uppercase">Werkbon</h1>
                        <p className="text-sm font-bold text-orange-500 tracking-widest mt-1">TIMESHEET REPORT</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">ID: {entry.id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs text-neutral-500">{format(new Date(), 'dd MMMM yyyy HH:mm', { locale: nl })}</p>
                    </div>
                </header>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-12 mb-12">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">Medewerker Details</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="text-sm font-bold">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-500">
                                <span>{entry.user?.email}</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">Datum & Tijd</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="font-bold">{format(start, 'eeee dd MMMM yyyy', { locale: nl })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{format(start, 'HH:mm')} - {end ? format(end, 'HH:mm') : 'Ongoing'}</span>
                                <span className="ml-auto font-black text-neutral-900 dark:text-white">{durationHrs}u {durationMins}m</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Context */}
                <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-6 mb-12 border border-neutral-100 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <ClipboardList className="w-4 h-4 text-orange-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">Project / Locatie</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Project</p>
                            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{entry.project?.name || 'Algemene Werken'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Code</p>
                            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{entry.project?.projectCode || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Work Description */}
                <div className="mb-12">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1 mb-4">Omschrijving van de werken</h3>
                    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl p-6 min-h-[150px]">
                        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                            {entry.taskDescription || 'Geen gedetailleerde omschrijving opgegeven.'}
                        </p>
                    </div>
                </div>

                {/* Photos */}
                {entry.photos.length > 0 && (
                    <div className="mb-12">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1 mb-4">Bijgevoegde Foto&apos;s</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {entry.photos.map((url, idx) => (
                                <div key={idx} className="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url.startsWith('t_') ? `/api/files/${url}` : url} alt={`Werf foto ${idx + 1}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Signature Area */}
                <div className="mt-auto pt-12 border-t border-neutral-100 grid grid-cols-2 gap-20">
                    <div className="space-y-8">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Handtekening Medewerker</p>
                        <div className="h-16 border-b border-neutral-300"></div>
                        <p className="text-[10px] text-neutral-400">{entry.user?.firstName} {entry.user?.lastName}</p>
                    </div>
                    <div className="space-y-8 text-right">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Handtekening Opdrachtgever</p>
                        <div className="h-16 border-b border-neutral-300"></div>
                        <p className="text-[10px] text-neutral-400">Gevalideerd op {format(new Date(), 'dd/MM/yyyy')}</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .min-h-screen { background: white !important; }
                }
            `}</style>
        </div>
    );
}
