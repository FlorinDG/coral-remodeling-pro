"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { hrUpdate } from '@/components/time-tracker/lib/hr-api';
import { format, parseISO } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, MapPin, Clock, Edit2, ShieldAlert, X } from 'lucide-react';

interface TimesheetEntryDetailProps {
    entry: any; // using any temporarily to align with frontend types
    onUpdate: (updated: any) => void;
    unlockTokenValid: boolean;
}

export function TimesheetEntryDetail({ entry, onUpdate, unlockTokenValid }: TimesheetEntryDetailProps) {
    const locale = useLocale();
    const t = useTranslations('Hr.timesheets');
    const dateFnsLocale = locale === 'nl' ? nl : locale === 'fr' ? fr : enUS;

    const [loading, setLoading] = useState(false);
    const [editingClockOut, setEditingClockOut] = useState(false);
    const [clockOutTime, setClockOutTime] = useState('');
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

    // We never silently discard open form states!
    const showUnlockWarning = isApproved && !unlockTokenValid && editingClockOut;

    const handleForceClockOut = async () => {
        if (!clockOutTime) {
            setError('Please enter a valid time');
            return;
        }

        const dateBase = entry.clockInTime ? new Date(entry.clockInTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const combined = new Date(`${dateBase}T${clockOutTime}:00`);

        setLoading(true);
        setError('');
        try {
            const updated = await hrUpdate('clock-entries', entry.id, {
                clockOutTime: combined.toISOString(),
            });
            onUpdate(updated);
            setEditingClockOut(false);
        } catch (err: any) {
            setError(err.message || 'Failed to force clock-out');
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
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">In:</span> {entry.clockInTime ? format(parseISO(entry.clockInTime), 'HH:mm', { locale: dateFnsLocale }) : '-'}
                    </div>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">Uit:</span> {entry.clockOutTime ? format(parseISO(entry.clockOutTime), 'HH:mm', { locale: dateFnsLocale }) : <span className="text-amber-600 font-semibold">{t('running', { fallback: 'Loopt nog' })}</span>}
                    </div>
                    
                    {isRunning && (
                        <div className="pt-2">
                            {editingClockOut ? (
                                <div className="space-y-2">
                                    <input 
                                        type="time" 
                                        value={clockOutTime} 
                                        onChange={(e) => setClockOutTime(e.target.value)}
                                        disabled={!canEdit && !isRunning}
                                        className="border rounded px-2 py-1 text-sm bg-background w-full"
                                    />
                                    {error && <div className="text-red-500 text-xs">{error}</div>}
                                    <div className="flex gap-2">
                                        <Button size="sm" disabled={loading || (!canEdit && !isRunning)} onClick={handleForceClockOut}>
                                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('save', { fallback: 'Save' })}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingClockOut(false)}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setEditingClockOut(true)}>
                                    <Clock className="w-3 h-3 mr-1" />
                                    {t('forceClockOut', { fallback: 'Klok stopzetten' })}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* LOCATIONS */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('locations', { fallback: 'Locations' })}</h4>
                    <div className="text-sm flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-1 text-green-600" />
                        <div>
                            <span className="font-medium text-neutral-500 block">Start</span>
                            {entry.clockInLatitude ? `${entry.clockInLatitude}, ${entry.clockInLongitude}` : '-'}
                        </div>
                    </div>
                    <div className="text-sm flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-1 text-red-600" />
                        <div>
                            <span className="font-medium text-neutral-500 block">End</span>
                            {entry.clockOutLatitude ? `${entry.clockOutLatitude}, ${entry.clockOutLongitude}` : '-'}
                        </div>
                    </div>
                </div>

                {/* ATTRIBUTION & CONTENT */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('attribution', { fallback: 'Attribution' })}</h4>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">Project:</span> {entry.projectId || t('unassigned', { fallback: 'Niet toegewezen' })}
                    </div>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">Billable:</span> {entry.billable ? 'Yes' : 'No'}
                    </div>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">Source:</span> {entry.source}
                    </div>
                </div>

                {/* APPROVAL & AUDIT PREVIEW */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('approval', { fallback: 'Approval' })}</h4>
                    <div className="text-sm">
                        <span className="font-medium text-neutral-500">Status:</span> {entry.approvalStatus || 'Pending'}
                    </div>
                    {entry.editedAfterApproval && (
                        <div className="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md">
                            <Edit2 className="w-3 h-3" />
                            Edited after approval
                        </div>
                    )}
                    
                    {auditLogs.length > 0 && (
                        <div className="mt-4 border-t border-border pt-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Audit Trail</h4>
                            <div className="space-y-3">
                                {auditLogs.map((log) => (
                                    <div key={log.id} className="text-xs">
                                        <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                                            {format(new Date(log.createdAt), 'dd MMM HH:mm')} — {log.action}
                                        </div>
                                        {log.reason && <div className="text-neutral-500 italic">Reason: {log.reason}</div>}
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
