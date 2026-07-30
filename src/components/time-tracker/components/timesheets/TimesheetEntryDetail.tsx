import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { hrUpdate } from '@/components/time-tracker/lib/hr-api';
import { format, parseISO } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, MapPin, Clock, Edit2, ShieldAlert, X, FileText } from 'lucide-react';

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
    const [clockInTime, setClockInTime] = useState(entry.clockInTime ? new Date(entry.clockInTime).toISOString().substring(11, 16) : '');
    const [clockOutTime, setClockOutTime] = useState(entry.clockOutTime ? new Date(entry.clockOutTime).toISOString().substring(11, 16) : '');
    const [projectId, setProjectId] = useState(entry.projectId || '');
    const [error, setError] = useState('');
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    useEffect(() => {
        const fetchAudit = async () => {
            try {
                const res = await fetch(`/api/hr/audit-logs?entityId=${entry.id}&entityType=clockEntry`);
                if (res.ok) {
                    const data = await res.json();
                    setAuditLogs(data);
                }
            } catch (err) {
                console.error("Failed to load audit logs", err);
            }
        };
        fetchAudit();
    }, [entry.id]);

    const isApproved = entry.approvalStatus === 'approved';
    const canEdit = !isApproved || unlockTokenValid;
    const isRunning = !entry.clockOutTime;

    const showUnlockWarning = isApproved && !unlockTokenValid && editing;

    const handleSave = async () => {
        const dateBaseIn = entry.clockInTime ? new Date(entry.clockInTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const dateBaseOut = entry.clockOutTime ? new Date(entry.clockOutTime).toISOString().split('T')[0] : dateBaseIn;
        
        const combinedIn = clockInTime ? new Date(`${dateBaseIn}T${clockInTime}:00`) : null;
        const combinedOut = clockOutTime ? new Date(`${dateBaseOut}T${clockOutTime}:00`) : null;

        setLoading(true);
        setError('');
        try {
            const updated = await hrUpdate('clock-entries', entry.id, {
                clockInTime: combinedIn?.toISOString(),
                clockOutTime: combinedOut?.toISOString(),
                projectId: projectId || null,
            });
            onUpdate(updated);
            setEditing(false);
        } catch (err: any) {
            setError(err.message || 'Failed to update entry');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-neutral-50 dark:bg-white/5 border border-border p-4 rounded-xl m-2 space-y-4 shadow-inner">
            
            {showUnlockWarning && (
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                    <ShieldAlert className="w-4 h-4" />
                    {t('editWindowExpired', { fallback: 'The edit window expired — unlock again to save' })}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                                    <X className="w-3 h-3" />
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
                                
                                {entry.shiftId && (
                                    <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => window.open(`/api/hr/werkbon?shiftId=${entry.shiftId}`, '_blank')}>
                                        <FileText className="w-3 h-3 mr-1" />
                                        {t('viewWorkOrder', { fallback: 'Bekijk werkbon' })}
                                    </Button>
                                )}
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
                            {entry.clockInLatitude ? `${entry.clockInLatitude}, ${entry.clockInLongitude}` : '-'}
                        </div>
                    </div>
                    <div className="text-sm flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-1 text-red-600" />
                        <div>
                            <span className="font-medium text-neutral-500 block">{t('end', { fallback: 'End' })}</span>
                            {entry.clockOutLatitude ? `${entry.clockOutLatitude}, ${entry.clockOutLongitude}` : '-'}
                        </div>
                    </div>
                </div>

                {/* ATTRIBUTION & CONTENT */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('attribution', { fallback: 'Attribution' })}</h4>
                    
                    {editing ? (
                        <div className="text-sm space-y-1">
                            <span className="font-medium text-neutral-500 block">{t('project', { fallback: 'Project' })}:</span>
                            <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!canEdit} className="border rounded px-2 py-1 text-xs w-full" placeholder="Project ID" />
                        </div>
                    ) : (
                        <div className="text-sm">
                            <span className="font-medium text-neutral-500">{t('project', { fallback: 'Project' })}:</span> {entry.projectId || t('unassigned', { fallback: 'Niet toegewezen' })}
                        </div>
                    )}
                    
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">{t('billable', { fallback: 'Billable' })}:</span> {entry.billable ? t('yes', { fallback: 'Yes' }) : t('no', { fallback: 'No' })}
                    </div>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">{t('source', { fallback: 'Source' })}:</span> {entry.source}
                    </div>
                </div>

                {/* APPROVAL & AUDIT PREVIEW */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('approval', { fallback: 'Approval' })}</h4>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">{t('status', { fallback: 'Status' })}:</span> {entry.approvalStatus || 'Pending'}
                    </div>
                    {entry.editedAfterApproval && (
                        <div className="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md">
                            <Edit2 className="w-3 h-3" />
                            {t('editedAfterApproval', { fallback: 'Edited after approval' })}
                        </div>
                    )}
                    
                    {auditLogs.length > 0 && (
                        <div className="mt-4 border-t border-border pt-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">{t('auditTrail', { fallback: 'Audit Trail' })}</h4>
                            <div className="space-y-3">
                                {auditLogs.map((log) => (
                                    <div key={log.id} className="text-xs">
                                        <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                                            {format(new Date(log.createdAt), 'dd MMM HH:mm')} — {log.action}
                                        </div>
                                        {log.reason && <div className="text-neutral-500 italic">{t('reason', { fallback: 'Reason' })}: {log.reason}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}
