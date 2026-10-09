/**
 * GRID-SURFACE-1 · Schedule Grid Model
 *
 * Pure data transformation mapping ScheduledShift[] to SchedulerGridRow[]
 * for rendering inside DataGridSurface.
 */
import { shiftMoment } from '@/lib/kernel/shift-time';
import { formatTime, formatWeekdayDayMonth } from '@/lib/format/date';
import { shiftStatus, type ShiftStatus } from '@/lib/kernel/shift-status';
import { projectColorOf } from '@/lib/records/project-color';
import type { ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';

export interface SchedulerGridRow {
    id: string;
    shiftDate: string;
    formattedDate: string;
    timeRange: string;
    workerName: string;
    userId: string;
    project: {
        id: string;
        name: string;
        color?: string;
        address?: string;
    } | null;
    projectColor: { name: string; value: string; bg: string } | null;
    address: string;
    role: string;
    formattedRole: string;
    status: ShiftStatus;
    isConflict: boolean;
    rawShift: ScheduledShift;
}

export function getNotionProjectColor(colorName?: string | null) {
    if (!colorName) return null;
    return projectColorOf(colorName);
}

export function formatSchedulerDate(dateStr: string, locale?: string | null): string {
    if (!dateStr) return '—';
    return formatWeekdayDayMonth(dateStr, locale);
}

export function formatSchedulerTimeRange(start?: string | null, end?: string | null): string {
    return `${formatTime(start || '00:00')} - ${formatTime(end || '00:00')}`;
}

export function mapShiftToGridRow(
    shift: ScheduledShift,
    options?: {
        locale?: string;
        tShifts?: (k: string) => string;
        conflictIds?: Set<string>;
    }
): SchedulerGridRow {
    if (!shift || !shift.id) {
        throw new Error('Invalid shift: missing shift or shift.id');
    }
    const locale = options?.locale;
    const tShifts = options?.tShifts;
    const conflictIds = options?.conflictIds;

    const formattedDate = formatSchedulerDate(shift.shiftDate, locale);
    const timeRange = formatSchedulerTimeRange(shift.shiftStart, shift.shiftEnd);
    const workerName = shift.userName || 'Unknown';
    const projectColor = shift.project?.color ? getNotionProjectColor(shift.project.color) : null;
    const address = (shift as { siteAddress?: string | null }).siteAddress || shift.project?.address || '—';

    let formattedRole = '—';
    if (shift.role) {
        const key = `roles.${shift.role}`;
        formattedRole = tShifts ? tShifts(key) : shift.role;
    }

    const status = shiftStatus(shift, shift.clockEntries || []);
    const isConflict = Boolean(conflictIds?.has(shift.id));

    return {
        id: shift.id,
        shiftDate: shift.shiftDate || '',
        formattedDate,
        timeRange,
        workerName,
        userId: shift.userId || '',
        project: shift.project ? {
            id: shift.project.id,
            name: shift.project.name,
            color: shift.project.color,
            address: shift.project.address || undefined,
        } : null,
        projectColor,
        address,
        role: shift.role || '',
        formattedRole,
        status,
        isConflict,
        rawShift: shift,
    };
}
