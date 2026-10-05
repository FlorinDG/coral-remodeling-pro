"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { hrList } from '@/lib/hr-api';
import { Loader2, ArrowLeft, Printer, Download, Clock, Calendar, User, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { resolveFileUrl } from '@/lib/files';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { zonedParts, isShiftSubmitted } from '@/lib/kernel/shift-time';

/** The client's signature, from the work order's FROZEN signing evidence (AuditLog 'sign' on the shift). */
interface SignEvidence { signerName: string; signedAt: string; signatureKey: string; number?: string }

interface Employee {
    id: string;
    userId?: string | null;
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
    photos: string[];
    noBreak: boolean;
    user?: Employee;
    project?: ErpProject | null;
}

export default function WerkbonDetailPage() {
    const params = useParams();
    const id = params.id as string;
    
    const [entry, setEntry] = useState<ClockEntry | null>(null);
    const [shiftAttachments, setShiftAttachments] = useState<any[]>([]);
    const [signature, setSignature] = useState<SignEvidence | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);

    const locale = useLocale();
    const dateFnsLocale = locale === 'nl' ? nl : locale === 'fr' ? fr : enUS;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // In a real app, we'd have a get-by-id endpoint, but here we'll filter the list
                const [entriesData, employeesData, projectsData, shiftsData] = await Promise.all([
                    hrList<ClockEntry>('clock-entries'),
                    hrList<Employee>('employees'),
                    hrList<ErpProject>('erp-projects').catch(() => []),
                    hrList<any>('scheduled-shifts').catch(() => [])
                ]);

                const rawEntry = entriesData.find(e => e.id === id);
                if (rawEntry) {
                    // Match by Employee.userId (correct) or Employee.id (legacy pre-backfill rows)
                    const employee = employeesData.find((e) => e.userId === rawEntry.userId)
                        || employeesData.find((e) => e.id === rawEntry.userId);
                    const shift = (rawEntry as any).shiftId ? shiftsData.find((s: any) => s.id === (rawEntry as any).shiftId) : null;
                    const effectiveProjectId = (rawEntry as any).projectId || shift?.projectId;
                    const project = effectiveProjectId ? projectsData.find(p => p.id === effectiveProjectId) : null;

                    let attachmentsList: any[] = [];
                    let ev: SignEvidence | null = null;
                    if ((rawEntry as any).shiftId) {
                        const sid = (rawEntry as any).shiftId as string;
                        const [atts, logs] = await Promise.all([
                            hrList<any>('shift-attachments', { shiftId: sid }).catch(() => []),
                            hrList<any>('audit-logs', { entityType: 'shift', entityId: sid }).catch(() => []),
                        ]);
                        attachmentsList = Array.isArray(atts) ? atts : [];
                        const sign = (Array.isArray(logs) ? logs : []).find((l: any) => l.action === 'sign');
                        ev = sign?.after ? (sign.after as SignEvidence) : null;
                    }
                    // The signature belongs in the client's signature slot — not among the attachments.
                    setShiftAttachments(ev ? attachmentsList.filter(a => a.url !== ev!.signatureKey) : attachmentsList);
                    setSignature(ev);
                    setSubmitted(isShiftSubmitted(shift?.status));

                    setEntry({
                        ...rawEntry,
                        user: employee,
                        project: project || null,
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

    // Times on the business clock (Brussels, kernel); the duration by the break rule — as on every other screen.
    const startP = zonedParts(entry.clockInTime);
    const endP = entry.clockOutTime ? zonedParts(entry.clockOutTime) : null;
    const [sy, sm, sd] = startP.date.split('-').map(Number);
    const dayLabel = format(new Date(sy, sm - 1, sd), 'eeee dd MMMM yyyy', { locale: dateFnsLocale });
    const worked = entry.clockOutTime ? computeWorkedDuration(entry.clockInTime, entry.clockOutTime, entry.noBreak).totalMinutes : 0;
    const durationHrs = Math.floor(worked / 60);
    const durationMins = worked % 60;
    const signedDate = signature ? (() => { const p = zonedParts(signature.signedAt); const [y, m, d] = p.date.split('-').map(Number); return `${format(new Date(y, m - 1, d), 'dd MMMM yyyy', { locale: dateFnsLocale })} ${p.time}`; })() : '';

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
                    <Button variant="default" size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => window.print()}>
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
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">{signature?.number ? signature.number : `ID: ${entry.id.slice(-8).toUpperCase()}`}</p>
                        <p className="text-xs text-neutral-500">Afgedrukt op: {format(new Date(), 'dd MMMM yyyy HH:mm', { locale: dateFnsLocale })}</p>
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
                                <span className="font-bold">{dayLabel}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{startP.time} - {endP ? endP.time : 'Ongoing'}</span>
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

                {/* Photos & Attachments */}
                {((entry.photos && entry.photos.length > 0) || shiftAttachments.length > 0) && (
                    <div className="mb-12">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1 mb-4">Bijgevoegde Foto&apos;s &amp; Documenten</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {entry.photos.map((rawPhoto, idx) => {
                                const photoUrl = typeof rawPhoto === 'string' ? rawPhoto : ((rawPhoto as any)?.url || (rawPhoto as any)?.key || '');
                                if (!photoUrl) return null;
                                return (
                                    <a key={`photo-${idx}`} href={resolveFileUrl(photoUrl)} target="_blank" rel="noopener noreferrer" className="group aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 flex flex-col relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={resolveFileUrl(photoUrl)} alt={`Werf foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">Foto (Klok)</span>
                                    </a>
                                );
                            })}
                            {shiftAttachments.map((att, idx) => {
                                const isImg = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.url || att.name || '');
                                return (
                                    <a key={`att-${idx}`} href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer" className="group aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 flex flex-col relative p-2">
                                        {isImg ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={resolveFileUrl(att.url)} alt={att.name || 'Bijlage'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center gap-1 text-neutral-600 dark:text-neutral-400">
                                                <ClipboardList className="w-6 h-6 text-orange-500" />
                                                <span className="text-xs font-semibold line-clamp-1 text-center">{att.name || 'Document'}</span>
                                                {att.size && att.size > 0 ? (
                                                    <span className="text-[10px] text-neutral-400">{Math.round(att.size / 1024)} KB</span>
                                                ) : null}
                                            </div>
                                        )}
                                        <span className="absolute bottom-1 left-1 bg-orange-600/80 text-white text-[9px] px-1.5 py-0.5 rounded">Bijlage (Dienst)</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer — ONE signature: the client's (the order giver signs the work order on the crew phone).
                    The worker does not sign here: submitting the shift in the app IS the worker's signature
                    (Florin 2026-10-05). Kept together on one printed page. */}
                <div className="mt-auto pt-10 border-t border-neutral-100 grid grid-cols-2 gap-16 break-inside-avoid" style={{ breakInside: 'avoid' }}>
                    <div className="space-y-2 text-[10px] text-neutral-500">
                        <p className="font-bold text-neutral-400 uppercase">Medewerker</p>
                        <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'N/A'}</p>
                        <p>{submitted ? 'Ingediend in CoralOS — indienen geldt als handtekening.' : 'Nog niet ingediend.'}</p>
                    </div>
                    <div className="space-y-2 text-right">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Handtekening Opdrachtgever</p>
                        {signature ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={resolveFileUrl(signature.signatureKey)} alt={`Handtekening — ${signature.signerName}`} className="ml-auto h-20 object-contain" />
                                <p className="text-[10px] text-neutral-600 dark:text-neutral-300">{signature.signerName} · {signedDate}</p>
                            </>
                        ) : (
                            <>
                                <div className="h-16 border-b border-neutral-300"></div>
                                <p className="text-[10px] text-neutral-400">Datum: ____________________</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 12mm; }
                    .no-print { display: none !important; }
                    .min-h-\[297mm\] { min-height: 0 !important; padding: 0 !important; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .min-h-screen { background: white !important; }
                }
            `}</style>
        </div>
    );
}
