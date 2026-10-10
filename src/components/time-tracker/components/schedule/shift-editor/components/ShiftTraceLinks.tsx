'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { zonedParts } from '@/lib/kernel/shift-time';
import { ShiftActualsLine } from '../../ShiftActualsLine';

interface TracedEntry { id: string; traceNo?: string | null; clockInTime: string | Date; clockOutTime?: string | Date | null; noBreak?: boolean | null }

/** The timesheet, opened on one hours entry (its day as the period, the entry expanded). */
export function hoursHref(entry: { id: string; clockInTime: string | Date }): string {
    const day = zonedParts(new Date(entry.clockInTime)).date;
    return `/admin/hr/timesheets?from=${day}&to=${day}&period=custom&entry=${encodeURIComponent(entry.id)}`;
}

/**
 * TRACE-1 · the shift's trace number and its clocked hours, each a link to the timesheet entry (Florin 2026-10-10:
 * "a link on the shift and one on the clocked hours entry — cross linking between the shift and hours").
 */
export function ShiftTraceLinks({ traceNo, entries }: { traceNo?: string | null; entries?: TracedEntry[] | null }) {
    const t = useTranslations('Hr.shifts.trace');
    const list = entries ?? [];
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {traceNo && <span className="font-mono font-semibold text-foreground">{traceNo}</span>}
            <span>{t('linkedHours')}:</span>
            {list.length === 0 ? <span className="italic">{t('noHoursYet')}</span> : list.map(e => (
                <Link key={e.id} href={hoursHref(e)} title={t('openHours')}
                    className="font-mono text-primary hover:underline">{e.traceNo || e.id.slice(0, 8)}</Link>
            ))}
            <ShiftActualsLine entries={list} className="basis-full !text-xs" />
        </div>
    );
}
