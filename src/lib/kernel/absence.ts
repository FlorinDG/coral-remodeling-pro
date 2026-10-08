/**
 * KERNEL · ABSENCE — leave is an absence, not a shift. Pure, tenant-free, no I/O.
 *
 * Florin 2026-10-08: "leave should not be treated as a shift, and scheduling a shift on the same date and time
 * frame as a leave should flag it as a conflict." The ONE record of "who is off" is the TimeOffRequest
 * (ground-zero LEAVE-MODEL-DUPLICATION, decided: TimeOffRequest canonical). The scheduler shows absences as
 * absence days; they are never edited, timed, clocked or counted as a shift.
 *
 * An absence covers WHOLE days (the request carries dates, not hours), so any shift of that worker on one of those
 * days overlaps it. Days are calendar strings (addDaysYmd) — no Date, no zone.
 */
import { addDaysYmd } from './shift-time';

/** Requests that keep a person off work: approved is leave; pending is asked-for leave (still flagged). */
const BLOCKING = new Set(['approved', 'pending']);

export interface Absence { id: string; userId: string; startDate: string; endDate: string; status: string; requestType?: string | null }
export interface AbsenceShift { id: string; userId?: string | null; shiftDate?: string | null; status?: string | null }
export interface LeaveConflict { shiftId: string; userId: string; absenceId: string; date: string; pending: boolean; requestType: string }

const ymdOf = (s: string) => (s || '').slice(0, 10);

/** Whether this request keeps the worker off (approved or still pending). */
export function isBlockingAbsence(a: Pick<Absence, 'status'>): boolean {
    return BLOCKING.has((a.status || '').toLowerCase());
}

/** Every calendar day of an absence, start to end inclusive (capped at a year — a typo must not hang a screen). */
export function absenceDays(a: Pick<Absence, 'startDate' | 'endDate'>): string[] {
    const start = ymdOf(a.startDate);
    const end = ymdOf(a.endDate) || start;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || end < start) return start ? [start] : [];
    const days: string[] = [];
    for (let d = start; d <= end && days.length < 366; d = addDaysYmd(d, 1)) days.push(d);
    return days;
}

/** Does the worker have a blocking absence on this day? */
export function absenceOn(absences: Absence[], userId: string, date: string): Absence | null {
    return absences.find(a => a.userId === userId && isBlockingAbsence(a) && ymdOf(a.startDate) <= date && date <= (ymdOf(a.endDate) || ymdOf(a.startDate))) || null;
}

/** Every shift that falls on a day its worker is off — a conflict to flag (never a refusal: the planner decides). */
export function leaveConflicts(shifts: AbsenceShift[], absences: Absence[]): LeaveConflict[] {
    const out: LeaveConflict[] = [];
    for (const s of shifts) {
        if (!s.userId || !s.shiftDate) continue;
        if ((s.status || '').toLowerCase() === 'cancelled') continue;
        const a = absenceOn(absences, s.userId, s.shiftDate);
        if (a) out.push({ shiftId: s.id, userId: s.userId, absenceId: a.id, date: s.shiftDate, pending: (a.status || '').toLowerCase() === 'pending', requestType: a.requestType || 'leave' });
    }
    return out;
}
