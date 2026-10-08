"use client";
/**
 * WERKBON-VIEW-1 · the hours print of one clock entry ("werkbon"), as ONE component: shown in a viewer over the
 * timesheet (Florin 2026-10-08: "the werkbon opens in a full ERP window, as opposed to any other doc that opens in a
 * viewer window"), and on its own print page (/admin/hr/timesheets/[id]).
 * It reads ONE entry, its worker, shift and project by id (it used to read every clock entry, employee, shift and
 * project of the tenant to show one).
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Clock, Calendar, User, ClipboardList, Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { nl, fr, enUS, ro } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { hrList } from '@/lib/hr-api';
import { resolveFileUrl } from '@/lib/files';
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { zonedParts, isShiftSubmitted } from '@/lib/kernel/shift-time';
import { WerkbonCard } from '@/components/time-tracker/components/werkbon/WerkbonCard';
import { isWerkbonArtifact } from '@/lib/records/werkbon-status';
import { isWerkbonFile } from '@/lib/records/werkbon-number';
import { Button } from '@/components/ui/button';

/** The client's signature, from the work order's FROZEN signing evidence (AuditLog 'sign' on the shift). */
interface SignEvidence { signerName: string; signedAt: string; number?: string }

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

interface WerkbonData {
    entry: ClockEntry;
    shiftAttachments: any[];
    signature: SignEvidence | null;
    submitted: boolean;
    shiftId: string | null;
}

/** One entry → everything its werkbon shows. null when the entry is not found (or not within the reader's reach). */
async function loadWerkbon(entryId: string): Promise<WerkbonData | null> {
    const [rawEntry] = await hrList<ClockEntry>('clock-entries', { id: entryId });
    if (!rawEntry) return null;
    const shiftId = ((rawEntry as any).shiftId as string) || null;
    const [byUser, shifts, atts, logs] = await Promise.all([
        hrList<Employee>('employees', { userId: rawEntry.userId }).catch(() => []),
        shiftId ? hrList<any>('scheduled-shifts', { id: shiftId }).catch(() => []) : Promise.resolve([]),
        shiftId ? hrList<any>('shift-attachments', { shiftId }).catch(() => []) : Promise.resolve([]),
        shiftId ? hrList<any>('audit-logs', { entityType: 'shift', entityId: shiftId }).catch(() => []) : Promise.resolve([]),
    ]);
    // Match by Employee.userId (correct) or Employee.id (legacy pre-backfill rows)
    const employee = byUser[0] || (await hrList<Employee>('employees', { id: rawEntry.userId }).catch(() => []))[0];
    const shift = shifts[0] || null;
    const projectId = (rawEntry as any).projectId || shift?.projectId;
    const project = projectId ? (await hrList<ErpProject>('erp-projects', { id: projectId }).catch(() => []))[0] : null;
    const sign = (Array.isArray(logs) ? logs : []).find((l: any) => l.action === 'sign');
    return {
        entry: { ...rawEntry, user: employee, project: project || null, photos: Array.isArray(rawEntry.photos) ? rawEntry.photos : [] },
        // The signed PDF has its own block (WerkbonCard); the signature is never shown as a file.
        shiftAttachments: (Array.isArray(atts) ? atts : []).filter(a => !isWerkbonArtifact({ name: a.name }, isWerkbonFile)),
        signature: sign?.after ? (sign.after as SignEvidence) : null,
        submitted: isShiftSubmitted(shift?.status),
        shiftId,
    };
}

export function useWerkbon(entryId: string | null) {
    const [data, setData] = useState<WerkbonData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let alive = true;
        if (!entryId) { setData(null); setLoading(false); return; }
        setLoading(true);
        loadWerkbon(entryId)
            .then(d => { if (alive) setData(d); })
            .catch(err => { console.error('Failed to fetch werkbon:', err); if (alive) setData(null); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [entryId]);
    return { data, loading };
}

/** The A4 werkbon itself — no toolbar. `className="werkbon-print"` is what prints. */
export function WerkbonDocument({ data }: { data: WerkbonData }) {
    const { entry, shiftAttachments, signature, submitted, shiftId } = data;
    const t = useTranslations('Hr.werkbon');
    const locale = useLocale();
    const dateFnsLocale = locale === 'nl' ? nl : locale === 'fr' ? fr : locale === 'ro' ? ro : enUS;

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
        <div className="werkbon-print w-full max-w-[210mm] h-max bg-white dark:bg-neutral-900 shadow-2xl rounded-sm min-h-[297mm] p-[20mm] flex flex-col print:shadow-none print:m-0 print:rounded-none">
            {/* Header */}
            <header className="flex justify-between items-start border-b-2 border-orange-500 pb-8 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-neutral-900 dark:text-white uppercase">{t('title')}</h1>
                    <p className="text-sm font-bold text-orange-500 tracking-widest mt-1">{t('timesheetReport')}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">{signature?.number ? signature.number : `ID: ${entry.id.slice(-8).toUpperCase()}`}</p>
                    <p className="text-xs text-neutral-500">{t('printedOn', { date: format(new Date(), 'dd MMMM yyyy HH:mm', { locale: dateFnsLocale }) })}</p>
                </div>
            </header>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-12 mb-12">
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">{t('workerDetails')}</h3>
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
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1">{t('dateTime')}</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="font-bold">{dayLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{startP.time} - {endP ? endP.time : t('ongoing')}</span>
                            <span className="ml-auto font-black text-neutral-900 dark:text-white">{durationHrs}{t('hoursShort')} {durationMins}{t('minutesShort')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Project Context */}
            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-6 mb-12 border border-neutral-100 dark:border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="w-4 h-4 text-orange-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">{t('projectLocation')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">{t('project')}</p>
                        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{entry.project?.name || t('defaultProject')}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">{t('code')}</p>
                        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{entry.project?.projectCode || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Work Description */}
            <div className="mb-12">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1 mb-4">{t('workDescription')}</h3>
                <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl p-6 min-h-[150px]">
                    <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                        {entry.taskDescription || t('noDescription')}
                    </p>
                </div>
            </div>

            {/* The signed work order — its own labelled block, never among the attachments */}
            <WerkbonCard shiftId={shiftId} className="mb-12 break-inside-avoid" />

            {/* Photos & Attachments */}
            {((entry.photos && entry.photos.length > 0) || shiftAttachments.length > 0) && (
                <div className="mb-12">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1 mb-4">{t('attachedMedia')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {entry.photos.map((rawPhoto, idx) => {
                            const photoUrl = typeof rawPhoto === 'string' ? rawPhoto : ((rawPhoto as any)?.url || (rawPhoto as any)?.key || '');
                            if (!photoUrl) return null;
                            return (
                                <a key={`photo-${idx}`} href={resolveFileUrl(photoUrl)} target="_blank" rel="noopener noreferrer" className="group aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 flex flex-col relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={resolveFileUrl(photoUrl)} alt={`Werf foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">{t('photoClock')}</span>
                                </a>
                            );
                        })}
                        {shiftAttachments.map((att, idx) => {
                            const isImg = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.url || att.name || '');
                            return (
                                <a key={`att-${idx}`} href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer" className="group aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 flex flex-col relative p-2">
                                    {isImg ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={resolveFileUrl(att.url)} alt={att.name || t('attachmentDoc')} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-1 text-neutral-600 dark:text-neutral-400">
                                            <ClipboardList className="w-6 h-6 text-orange-500" />
                                            <span className="text-xs font-semibold line-clamp-1 text-center">{att.name || t('attachmentDoc')}</span>
                                            {att.size && att.size > 0 ? (
                                                <span className="text-[10px] text-neutral-400">{Math.round(att.size / 1024)} KB</span>
                                            ) : null}
                                        </div>
                                    )}
                                    <span className="absolute bottom-1 left-1 bg-orange-600/80 text-white text-[9px] px-1.5 py-0.5 rounded">{t('attachmentShift')}</span>
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
                    <p className="font-bold text-neutral-400 uppercase">{t('worker')}</p>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'N/A'}</p>
                    <p>{submitted ? t('submittedInApp') : t('notYetSubmitted')}</p>
                </div>
                <div className="space-y-2 text-right">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">{t('clientSignature')}</p>
                    {signature ? (
                        <>
                            {/* The signature itself is only in the signed PDF (privacy) — here: who, when, which work order. */}
                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">✓ {signature.signerName}</p>
                            <p className="text-[10px] text-neutral-600 dark:text-neutral-300">{signedDate}{signature.number ? ` · ${signature.number}` : ''}</p>
                        </>
                    ) : (
                        <>
                            <div className="h-16 border-b border-neutral-300"></div>
                            <p className="text-[10px] text-neutral-400">{t('dateLine')}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Prints only the werkbon (the viewer sits over the ERP; the page around it must not print). */
export const WERKBON_PRINT_CSS = `
@media print {
    @page { size: A4; margin: 12mm; }
    body * { visibility: hidden !important; }
    .werkbon-print, .werkbon-print * { visibility: visible !important; }
    .werkbon-print { position: absolute !important; left: 0; top: 0; width: 100% !important; max-width: none !important;
        min-height: 0 !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
    .no-print { display: none !important; }
}`;

/** WERKBON-VIEW-1 · the werkbon in a viewer over the current screen — like every other document. */
export function WerkbonViewer({ entryId, onClose }: { entryId: string; onClose: () => void }) {
    const t = useTranslations('Hr.werkbon');
    const { data, loading } = useWerkbon(entryId);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    // Portalled to <body>: opened from inside a table row, a blurred/transformed ancestor would otherwise trap it.
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div role="dialog" aria-modal="true" aria-label={t('title')} className="fixed inset-0 z-[80] flex flex-col bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <style>{WERKBON_PRINT_CSS}</style>
            <div className="no-print flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('title')}</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" disabled={!data} onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> {t('printPdf')}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2" onClick={onClose} aria-label={t('close')}>
                        <X className="w-4 h-4" /> {t('close')}
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-neutral-100/90 dark:bg-neutral-950/90" onClick={e => e.stopPropagation()}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
                ) : data ? (
                    <WerkbonDocument data={data} />
                ) : (
                    <p className="py-24 text-sm text-neutral-500">{t('notFound')}</p>
                )}
            </div>
        </div>,
        document.body,
    );
}
