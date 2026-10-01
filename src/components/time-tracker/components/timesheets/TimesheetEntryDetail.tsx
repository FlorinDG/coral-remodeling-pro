import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { hrUpdate, hrList } from '@/lib/hr-api';
import { format, parseISO } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, MapPin, Clock, Edit2, ShieldAlert, X, FileText } from 'lucide-react';
import { resolveFileUrl } from '@/lib/files';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { isSelfApproved } from '@/lib/provenance';
import { describeError } from '@/lib/describe-error';

interface TimesheetEntryDetailProps {
    entry: any;
    onUpdate: (updated: any) => void;
    unlockTokenValid: boolean;
}

export function TimesheetEntryDetail({ entry, onUpdate, unlockTokenValid }: TimesheetEntryDetailProps) {
    const locale = useLocale();
    const t = useTranslations('Hr.timesheets');
    const dateFnsLocale = locale === 'nl' ? nl : locale === 'fr' ? fr : enUS;

    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [clockInTime, setClockInTime] = useState(entry.clockInTime ? format(parseISO(entry.clockInTime), 'HH:mm') : '');
    const [clockOutTime, setClockOutTime] = useState(entry.clockOutTime ? format(parseISO(entry.clockOutTime), 'HH:mm') : '');
    const [projectId, setProjectId] = useState(entry.projectId || '');
    const [billable, setBillable] = useState(entry.billable !== false);
    const [notes, setNotes] = useState(entry.notes || '');
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [error, setError] = useState('');
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [shiftAttachments, setShiftAttachments] = useState<any[]>([]);

    useEffect(() => {
        setClockInTime(entry.clockInTime ? format(parseISO(entry.clockInTime), 'HH:mm') : '');
        setClockOutTime(entry.clockOutTime ? format(parseISO(entry.clockOutTime), 'HH:mm') : '');
        setProjectId(entry.projectId || '');
        setBillable(entry.billable !== false);
        setNotes(entry.notes || '');
        setEditing(false);
        setError('');
    }, [entry.id, entry.clockInTime, entry.clockOutTime, entry.projectId, entry.billable, entry.notes]);

    useEffect(() => {
        let active = true;
        hrList<{ id: string; name: string }>('erp-projects')
            .then(data => {
                if (active && Array.isArray(data)) setProjects(data);
            })
            .catch(err => console.error("Failed to load projects", err));
        return () => { active = false; };
    }, []);

    useEffect(() => {
        const fetchAudit = async () => {
            try {
                const res = await fetch(`/api/hr/audit-logs?entityId=${entry.id}&entityType=clockEntry`);
                if (res.ok) {
                    const data = await res.json();
                    setAuditLogs(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Failed to load audit logs", err);
            }
        };
        fetchAudit();
    }, [entry.id]);

    useEffect(() => {
        if (!entry.shiftId) {
            setShiftAttachments([]);
            return;
        }
        const fetchShiftAttachments = async () => {
            try {
                const res = await fetch(`/api/hr/shift-attachments?shiftId=${entry.shiftId}`);
                if (res.ok) {
                    const data = await res.json();
                    setShiftAttachments(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Failed to load shift attachments", err);
            }
        };
        fetchShiftAttachments();
    }, [entry.shiftId]);

    const entryPhotos = Array.isArray(entry.photos) ? entry.photos : [];
    const allMedia = [...entryPhotos, ...shiftAttachments];

    const isApproved = entry.approvalStatus === 'approved';
    const canEdit = !isApproved || unlockTokenValid;
    const isRunning = !entry.clockOutTime;

    const showUnlockWarning = isApproved && !unlockTokenValid && editing;

    const handleCancel = () => {
        setClockInTime(entry.clockInTime ? format(parseISO(entry.clockInTime), 'HH:mm') : '');
        setClockOutTime(entry.clockOutTime ? format(parseISO(entry.clockOutTime), 'HH:mm') : '');
        setProjectId(entry.projectId || '');
        setBillable(entry.billable !== false);
        setNotes(entry.notes || '');
        setError('');
        setEditing(false);
    };

    const handleSave = async () => {
        const dateBaseIn = entry.clockInTime ? format(parseISO(entry.clockInTime), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        const dateBaseOut = entry.clockOutTime ? format(parseISO(entry.clockOutTime), 'yyyy-MM-dd') : dateBaseIn;
        
        const combinedIn = clockInTime ? new Date(`${dateBaseIn}T${clockInTime}:00`) : null;
        const combinedOut = clockOutTime ? new Date(`${dateBaseOut}T${clockOutTime}:00`) : null;

        setLoading(true);
        setError('');
        try {
            const updated = await hrUpdate('clock-entries', entry.id, {
                clockInTime: combinedIn?.toISOString(),
                clockOutTime: combinedOut?.toISOString(),
                projectId: projectId || null,
                billable: Boolean(billable),
                notes: notes.trim() || null,
            });
            onUpdate(updated);
            setEditing(false);
        } catch (err: any) {
            console.error('[TimesheetEntryDetail] Update failed:', err);
            setError(`Failed to update entry — ${describeError(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const getSourceLabel = (src: string | undefined | null) => {
        switch (src) {
            case 'clocked':
                return t('sourceClocked', { fallback: 'Geklokt' });
            case 'late_entry':
                return t('sourceLateEntry', { fallback: 'Nageleverd' });
            case 'Aangepast':
            case 'adjusted':
                return t('sourceAdjusted', { fallback: 'Aangepast' });
            case 'admin_entry':
                return t('sourceAdminEntry', { fallback: 'Beheerdersinvoer' });
            case 'manual':
                return t('sourceManual', { fallback: 'Handmatig' });
            default:
                return src || t('sourceClocked', { fallback: 'Geklokt' });
        }
    };

    const getSourceExplanation = (src: string | undefined | null) => {
        switch (src) {
            case 'clocked':
                return t('sourceExplanationClocked', { fallback: 'Live via mobiele app geregistreerd' });
            case 'late_entry':
                return t('sourceExplanationLateEntry', { fallback: 'Naderhand ingediend door medewerker' });
            case 'Aangepast':
            case 'adjusted':
                return t('sourceExplanationAdjusted', { fallback: 'Gewijzigd door beheerder na registratie' });
            case 'admin_entry':
                return t('sourceExplanationAdminEntry', { fallback: 'Handmatig ingevoerd door beheerder' });
            case 'manual':
                return t('sourceExplanationManual', { fallback: 'Handmatig ingevoerd' });
            default:
                return t('sourceExplanationClocked', { fallback: 'Live via mobiele app geregistreerd' });
        }
    };

    const getActionLabel = (act: string | undefined | null) => {
        switch (act) {
            case 'update':
                return t('actionUpdate', { fallback: 'Bewerkt' });
            case 'approve':
                return t('actionApprove', { fallback: 'Goedgekeurd' });
            case 'unapprove':
                return t('actionUnapprove', { fallback: 'Goedkeuring ingetrokken' });
            case 'forceClockOut':
                return t('actionForceClockOut', { fallback: 'Klok geforceerd stopgezet' });
            default:
                return act || t('actionUpdate', { fallback: 'Bewerkt' });
        }
    };

    const currentProjectName = projects.find(p => p.id === (editing ? projectId : entry.projectId))?.name 
        || entry.projectName 
        || entry.project?.name 
        || (entry.projectId ? t('unknownProject', { fallback: 'Onbekend project' }) : t('unassigned', { fallback: 'Niet toegewezen' }));

    return (
        <div className="bg-neutral-50 dark:bg-white/5 border border-border p-4 rounded-xl m-2 space-y-4 shadow-inner">
            
            {showUnlockWarning && (
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                    <ShieldAlert className="w-4 h-4" />
                    {t('editWindowExpired', { fallback: 'The edit window expired — unlock again to save' })}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* TIMELINE */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('timeline', { fallback: 'Timeline' })}</h4>
                    
                    {editing ? (
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-neutral-500">{t('in', { fallback: 'In' })}:</span>
                                <input type="time" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} disabled={!canEdit} className="border rounded px-2 py-1 text-xs w-24" />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-neutral-500">{t('uit', { fallback: 'Uit' })}:</span>
                                <input type="time" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} disabled={!canEdit} className="border rounded px-2 py-1 text-xs w-24" />
                            </div>
                            {error && <div className="text-red-500 text-xs">{error}</div>}
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" disabled={loading || !canEdit} onClick={handleSave}>
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('save', { fallback: 'Save' })}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancel} title={t('cancel', { fallback: 'Annuleren' })} className="text-xs gap-1">
                                    <X className="w-3.5 h-3.5" />
                                    <span>{t('cancel', { fallback: 'Annuleren' })}</span>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-sm">
                                <span className="font-medium text-neutral-500">{t('in', { fallback: 'In' })}:</span> {entry.clockInTime ? format(parseISO(entry.clockInTime), 'HH:mm', { locale: dateFnsLocale }) : '-'}
                            </div>
                            <div className="text-sm">
                                <span className="font-medium text-neutral-500">{t('uit', { fallback: 'Uit' })}:</span> {entry.clockOutTime ? format(parseISO(entry.clockOutTime), 'HH:mm', { locale: dateFnsLocale }) : <span className="text-amber-600 font-semibold">{t('running', { fallback: 'Loopt nog' })}</span>}
                            </div>
                            
                            <div className="pt-2 flex flex-col gap-2">
                                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setEditing(true)}>
                                    {isRunning ? <Clock className="w-3 h-3 mr-1" /> : <Edit2 className="w-3 h-3 mr-1" />}
                                    {isRunning ? t('forceClockOut', { fallback: 'Klok stopzetten' }) : t('edit', { fallback: 'Bewerken' })}
                                </Button>
                                
                                <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => window.open(`/${locale}/admin/hr/timesheets/${entry.id}`, '_blank')}>
                                    <FileText className="w-3 h-3 mr-1" />
                                    {t('viewWorkOrder', { fallback: 'Bekijk werkbon' })}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* LOCATIONS */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('locations', { fallback: 'Locations' })}</h4>
                    <div className="text-sm flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-1 text-green-600" />
                        <div>
                            <span className="font-medium text-neutral-500 block">{t('start', { fallback: 'Start' })}</span>
                            <Place address={entry.clockInAddress} lat={entry.clockInLatitude} lng={entry.clockInLongitude} distance={entry.clockInDistanceM} locale={locale} farLabel={(km: string) => t('farFromSite', { km })} />
                        </div>
                    </div>
                    <div className="text-sm flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-1 text-red-600" />
                        <div>
                            <span className="font-medium text-neutral-500 block">{t('end', { fallback: 'End' })}</span>
                            <Place address={entry.clockOutAddress} lat={entry.clockOutLatitude} lng={entry.clockOutLongitude} distance={entry.clockOutDistanceM} locale={locale} farLabel={(km: string) => t('farFromSite', { km })} />
                        </div>
                    </div>
                </div>

                {/* ATTRIBUTION & CONTENT */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('attribution', { fallback: 'Attribution' })}</h4>
                    
                    {editing ? (
                        <div className="space-y-2 text-sm">
                            <div className="space-y-1">
                                <span className="font-medium text-neutral-500 block text-xs">{t('project', { fallback: 'Project' })}:</span>
                                <SearchableSelect
                                    options={[
                                        { value: '', label: `— ${t('noProject', { fallback: 'Geen project' })} —` },
                                        ...projects.map(p => ({ value: p.id, label: p.name }))
                                    ]}
                                    value={projectId}
                                    onChange={(val) => setProjectId(val)}
                                    placeholder={t('selectProject', { fallback: 'Selecteer project' })}
                                    disabled={!canEdit}
                                    className="w-full text-xs"
                                />
                            </div>

                            <div className="space-y-1 pt-1">
                                <span className="font-medium text-neutral-500 block text-xs">{t('billable', { fallback: 'Facturabel' })}:</span>
                                <button
                                    type="button"
                                    onClick={() => canEdit && setBillable(!billable)}
                                    disabled={!canEdit}
                                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                        billable
                                            ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300'
                                            : 'bg-neutral-100 border-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400'
                                    } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-orange-400'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${billable ? 'bg-orange-600 dark:bg-orange-400' : 'bg-neutral-400'}`} />
                                    <span>{billable ? t('billableYes', { fallback: 'Factureerbaar' }) : t('billableNo', { fallback: 'Niet factureerbaar (intern)' })}</span>
                                </button>
                            </div>

                            <div className="space-y-1 pt-1">
                                <span className="font-medium text-neutral-500 block text-xs">{t('notes', { fallback: 'Notities' })}:</span>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={!canEdit}
                                    className="border rounded px-2 py-1 text-xs w-full min-h-[50px] bg-white dark:bg-neutral-800"
                                    placeholder={t('notes', { fallback: 'Notities' })}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-sm">
                                <span className="font-medium text-neutral-500">{t('project', { fallback: 'Project' })}:</span>{' '}
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{currentProjectName}</span>
                            </div>
                            
                            <div className="text-sm">
                                <span className="font-medium text-neutral-500">{t('billable', { fallback: 'Facturabel' })}:</span>{' '}
                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                    {entry.billable !== false ? t('billableYes', { fallback: 'Factureerbaar' }) : t('billableNo', { fallback: 'Niet factureerbaar (intern)' })}
                                </span>
                            </div>

                            {entry.createdBy && entry.source !== 'clocked' && (
                                <div className="text-sm">
                                    <span className="font-medium text-neutral-500">{t('enteredBy', { fallback: 'Ingevoerd door' })}:</span>{' '}
                                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{entry.createdByName || t('admin', { fallback: 'Beheerder' })}</span>
                                </div>
                            )}

                            {entry.notes && (
                                <div className="text-sm pt-1">
                                    <span className="font-medium text-neutral-500 block text-xs">{t('notes', { fallback: 'Notities' })}:</span>
                                    <p className="text-xs text-neutral-700 dark:text-neutral-300 italic bg-neutral-100/80 dark:bg-white/5 p-2 rounded border border-neutral-200/50 dark:border-white/5 mt-0.5 whitespace-pre-wrap">
                                        {entry.notes}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                    
                    <div className="text-sm pt-1">
                        <span className="font-medium text-neutral-500 block mb-0.5">{t('source', { fallback: 'Bron' })}:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                                {getSourceLabel(entry.source)}
                            </span>
                            {auditLogs.length > 0 && (
                                <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                                    ({auditLogs.length} {auditLogs.length === 1 ? t('change', { fallback: 'wijziging' }) : t('changes', { fallback: 'wijzigingen' })})
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                            {getSourceExplanation(entry.source)}
                        </p>
                    </div>
                </div>

                {/* APPROVAL & AUDIT PREVIEW */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('approval', { fallback: 'Approval' })}</h4>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">{t('status', { fallback: 'Status' })}:</span>{' '}
                        <span className="font-semibold">
                            {entry.approvalStatus === 'approved' 
                                ? t('statusGoedgekeurd', { fallback: 'Goedgekeurd' })
                                : entry.approvalStatus === 'denied'
                                    ? t('statusGeweigerd', { fallback: 'Geweigerd' })
                                    : t('statusTeBeoordelen', { fallback: 'Te beoordelen' })}
                        </span>
                    </div>

                    {entry.approvalStatus === 'approved' && entry.approvedBy && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-tight">
                            <span className={isSelfApproved(entry) ? "text-amber-700 dark:text-amber-400 font-medium" : "font-medium"}>
                                {isSelfApproved(entry)
                                    ? t('selfApprovedBy', { name: entry.approverName || t('admin', { fallback: 'Beheerder' }) })
                                    : t('approvedByWorker', { name: entry.approverName || t('admin', { fallback: 'Beheerder' }) })}
                            </span>
                            {entry.approvedAt && (
                                <span className="block text-[10px] text-neutral-400 mt-0.5">
                                    {format(new Date(entry.approvedAt), 'dd/MM/yyyy HH:mm', { locale: dateFnsLocale })}
                                </span>
                            )}
                        </div>
                    )}

                    {entry.editedAfterApproval && (
                        <div className="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md">
                            <Edit2 className="w-3 h-3" />
                            {t('editedAfterApproval', { fallback: 'Edited after approval' })}
                        </div>
                    )}
                    
                    {auditLogs.length > 0 && (
                        <div className="mt-4 border-t border-border pt-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">{t('auditTrail', { fallback: 'Audit Trail' })}</h4>
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {auditLogs.map((log) => (
                                    <div key={log.id} className="text-xs bg-white dark:bg-neutral-900/60 p-2 rounded border border-neutral-200 dark:border-white/10 space-y-1">
                                        <div className="flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200">
                                            <span>{log.actorLabel || log.actorKind || 'Systeem'}</span>
                                            <span className="text-[10px] text-neutral-400 font-normal">
                                                {format(new Date(log.createdAt), 'dd MMM HH:mm', { locale: dateFnsLocale })}
                                            </span>
                                        </div>
                                        <div className="text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                                            <span className="font-medium uppercase text-[10px] tracking-wider text-orange-600 dark:text-orange-400">
                                                {getActionLabel(log.action)}
                                            </span>
                                            {log.field && <span className="text-[11px]">({log.field})</span>}
                                        </div>
                                        {log.reason && <div className="text-neutral-500 italic text-[11px]">{t('reason', { fallback: 'Reason' })}: {log.reason}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ATTACHMENTS & PHOTOS (HR-TS-3) */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('attachments', { fallback: "Foto's & Bijlagen" })}</h4>
                    {allMedia.length === 0 ? (
                        <div className="text-xs text-neutral-400 italic py-2">
                            {t('noAttachments', { fallback: "Geen foto's of bijlagen" })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {entryPhotos.map((rawPhoto: any, idx: number) => {
                                const photoUrl = typeof rawPhoto === 'string' ? rawPhoto : (rawPhoto?.url || rawPhoto?.key || '');
                                if (!photoUrl) return null;
                                return (
                                    <a
                                        key={`photo-${idx}`}
                                        href={resolveFileUrl(photoUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative aspect-square bg-neutral-200 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-300 dark:border-white/10 hover:border-orange-500 transition-colors flex flex-col"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={resolveFileUrl(photoUrl)} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded font-medium">Foto (Klok)</span>
                                    </a>
                                );
                            })}
                            {shiftAttachments.map((att: any, idx: number) => {
                                const isImg = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.url || att.name || '');
                                return (
                                    <a
                                        key={`att-${idx}`}
                                        href={resolveFileUrl(att.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative aspect-square bg-neutral-200 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-300 dark:border-white/10 hover:border-orange-500 transition-colors flex flex-col items-center justify-center p-1"
                                    >
                                        {isImg ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={resolveFileUrl(att.url)} alt={att.name || 'Bijlage'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-center p-1">
                                                <FileText className="w-5 h-5 text-orange-500 mb-0.5" />
                                                <span className="text-[10px] font-semibold line-clamp-1 text-neutral-700 dark:text-neutral-300">{att.name || 'Document'}</span>
                                                {att.size && att.size > 0 ? (
                                                    <span className="text-[9px] text-neutral-400">{Math.round(att.size / 1024)} KB</span>
                                                ) : null}
                                            </div>
                                        )}
                                        <span className="absolute bottom-1 left-1 bg-orange-600/90 text-white text-[9px] px-1 py-0.5 rounded font-medium">Bijlage (Dienst)</span>
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}

/** GEO-1: the street address (raw coordinates only when no address was recorded), a map link, and a
 *  flag when the clock event was more than 300 m from the work site — recorded, never blocking. */
function Place({ address, lat, lng, distance, locale, farLabel }: {
    address?: string | null; lat?: number | null; lng?: number | null; distance?: number | null; locale: string;
    farLabel: (km: string) => string;
}) {
    if (lat == null || lng == null) return <>-</>;
    const href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const far = distance != null && distance > 300;
    return (
        <>
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted break-words">
                {address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </a>
            {far && (
                <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 text-xs font-semibold">
                    {farLabel((distance! / 1000).toLocaleString(locale, { maximumFractionDigits: 1 }))}
                </span>
            )}
        </>
    );
}
