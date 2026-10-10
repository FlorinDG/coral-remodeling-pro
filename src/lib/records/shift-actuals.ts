/**
 * TRACE-1 · what was actually worked on a shift (Florin 2026-10-10: "the closed shifts must display under the line of
 * the scheduled hours another line holding the actual hours and their calculation"). Pure.
 * A shift is closed for this purpose when it has clocked hours and none of them is still open. Its actuals: the first
 * clock-in, the last clock-out (business time), the worked minutes after the canonical break rule
 * (lib/computeWorkedDuration — the same one the timesheets use), the break deducted, and the entries' trace numbers.
 */
import { computeWorkedDuration } from '@/lib/computeWorkedDuration';
import { zonedParts } from '@/lib/kernel/shift-time';

export interface ActualEntry { clockInTime: Date | string | null; clockOutTime?: Date | string | null; noBreak?: boolean | null; traceNo?: string | null; id?: string }
export interface ShiftActuals { start: string; end: string; workedMinutes: number; breakMinutes: number; rawMinutes: number; entries: { id?: string; traceNo: string | null }[] }

export function shiftActuals(entries: ActualEntry[] | null | undefined): ShiftActuals | null {
    const list = (entries ?? []).filter(e => e.clockInTime);
    if (list.length === 0 || list.some(e => !e.clockOutTime)) return null;
    let worked = 0, raw = 0;
    for (const e of list) {
        const d = computeWorkedDuration(e.clockInTime, e.clockOutTime ?? null, !!e.noBreak);
        worked += d.totalMinutes;
        raw += d.totalMinutes + (d.breakDeducted ? 30 : 0);
    }
    const ins = list.map(e => new Date(e.clockInTime as string | Date).getTime());
    const outs = list.map(e => new Date(e.clockOutTime as string | Date).getTime());
    return {
        start: zonedParts(new Date(Math.min(...ins))).time,
        end: zonedParts(new Date(Math.max(...outs))).time,
        workedMinutes: worked,
        breakMinutes: raw - worked,
        rawMinutes: raw,
        entries: list.map(e => ({ id: e.id, traceNo: e.traceNo ?? null })),
    };
}
