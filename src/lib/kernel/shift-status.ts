/**
 * KERNEL · SHIFT STATUS — the ONE vocabulary of a scheduled shift, and the status a person sees.
 * Pure, tenant-free, no I/O.
 *
 * Florin 2026-10-08: "shift gets automatic status of Scheduled. In the select element replace active with
 * Late, and assign late if clock-in is not present at shift start time."
 *
 * STORED (what a person or the submit flow writes): scheduled · late · completed · cancelled.
 * SHOWN (derived, never written by a read): the stored value, except
 *   · a clock entry still open           → in-progress
 *   · 'scheduled', the start has passed and nobody clocked in at or before it → late
 * Lateness is a fact of the wall clock in Brussels: shift strings are compared with the business clock's
 * date and HH:mm (zonedParts) — no Date is built from the shift, no offset arithmetic.
 *
 * Leave is NOT a shift status — an absence is a TimeOffRequest (kernel/absence.ts).
 * Legacy spellings ('Scheduled', 'Active', 'In Progress', 'Completed', 'Cancelled') read through storedStatus.
 */
import { zonedParts, BUSINESS_TIME_ZONE } from './shift-time';

export const STORED_SHIFT_STATUSES = ['scheduled', 'late', 'completed', 'cancelled'] as const;
export type StoredShiftStatus = typeof STORED_SHIFT_STATUSES[number];
export type ShiftStatus = StoredShiftStatus | 'in-progress';

/** The options of the status select, in order. 'in-progress' is shown, never chosen — clocking in makes it. */
export const SHIFT_STATUS_OPTIONS: readonly ShiftStatus[] = ['scheduled', 'late', 'in-progress', 'completed', 'cancelled'];

/** Any stored spelling → the canonical stored status. Unknown and legacy "active" values are 'scheduled'. */
export function storedStatus(raw: string | null | undefined): StoredShiftStatus {
    const s = (raw || '').trim().toLowerCase();
    if (s === 'late') return 'late';
    if (s === 'completed') return 'completed';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'scheduled';
}

/** Whether a status may be written by a person (the select). */
export function isWritableShiftStatus(raw: unknown): raw is StoredShiftStatus {
    return typeof raw === 'string' && (STORED_SHIFT_STATUSES as readonly string[]).includes(raw);
}

export interface StatusShift { shiftDate: string; shiftStart: string; status?: string | null }
export interface StatusEntry { clockInTime: string | Date; clockOutTime?: string | Date | null }

/** Did anyone clock in at or before the shift's start (Brussels wall clock, minute precision)? */
function clockedInOnTime(shift: StatusShift, entries: StatusEntry[], timeZone: string): boolean {
    return entries.some(e => {
        const p = zonedParts(e.clockInTime, timeZone);
        return p.date < shift.shiftDate || (p.date === shift.shiftDate && p.time <= shift.shiftStart);
    });
}

/** Has the shift's start passed at `now` (Brussels wall clock)? */
export function shiftStarted(shift: StatusShift, now: Date, timeZone: string = BUSINESS_TIME_ZONE): boolean {
    const n = zonedParts(now, timeZone);
    return n.date > shift.shiftDate || (n.date === shift.shiftDate && n.time >= shift.shiftStart);
}

/** Was the worker late — the start passed with no clock-in at or before it? (A fact; it stays after they arrive.) */
export function wasLate(shift: StatusShift, entries: StatusEntry[], now: Date, timeZone: string = BUSINESS_TIME_ZONE): boolean {
    if (storedStatus(shift.status) === 'late') return true;
    return shiftStarted(shift, now, timeZone) && !clockedInOnTime(shift, entries, timeZone);
}

/** The status a person sees. Precedence: cancelled · completed · in-progress · late · scheduled. */
export function shiftStatus(shift: StatusShift, entries: StatusEntry[] = [], now: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE): ShiftStatus {
    const stored = storedStatus(shift.status);
    if (stored === 'cancelled' || stored === 'completed') return stored;
    if (entries.some(e => !e.clockOutTime)) return 'in-progress';
    if (stored === 'late') return 'late';
    if (entries.length === 0 && shiftStarted(shift, now, timeZone)) return 'late';
    return 'scheduled';
}
