'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { shiftActuals, type ActualEntry } from '@/lib/records/shift-actuals';
import { formatHoursMinutes } from '@/lib/computeWorkedDuration';

/**
 * TRACE-1 · under a closed shift's planned line, the line of what was actually worked (Florin 2026-10-10): first
 * clock-in – last clock-out, the worked time after the break rule, and the break deducted. The calculation is core
 * (lib/records/shift-actuals); this only shows it. Nothing while hours are still open or none were clocked.
 */
export function ShiftActualsLine({ entries, className = '' }: { entries: ActualEntry[] | null | undefined; className?: string }) {
    const t = useTranslations('Hr.shifts.trace');
    const a = shiftActuals(entries);
    if (!a) return null;
    return (
        <div className={`text-[10px] font-medium text-emerald-700 dark:text-emerald-400 truncate tabular-nums ${className}`}
            title={a.entries.map(e => e.traceNo).filter(Boolean).join(' · ')}>
            {t('actual')} {a.start}–{a.end} · {formatHoursMinutes(a.workedMinutes)}
            {a.breakMinutes > 0 && <span className="text-neutral-500"> ({formatHoursMinutes(a.rawMinutes)} − {a.breakMinutes}m {t('breakShort')})</span>}
        </div>
    );
}
