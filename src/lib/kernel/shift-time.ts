/**
 * KERNEL · SHIFT TIME — pure, tenant-free, no I/O (coral-workhub-structure.md L0: "the kernel of
 * this module is TIME"). A step toward KERN-TIME.
 *
 * ScheduledShift stores its moment as TEXT (`shiftDate` 'YYYY-MM-DD', `shiftStart`/`shiftEnd` 'HH:mm').
 * 🛑 Never concatenate them into a string for `new Date()` — that parse is UTC in some engines and
 * local in others (the +2h bug, three times). Moments are BUILT FROM PARTS, in local time.
 */

export interface ShiftTimes { shiftDate: string; shiftStart: string; shiftEnd: string }
export type ShiftTemporalState = 'past' | 'current' | 'upcoming';

/** 'YYYY-MM-DD' + 'HH:mm' → a local Date, built from parts. */
export function shiftMoment(dateStr: string, timeStr: string): Date {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

/** Start and end of a shift; an end before the start means the shift crosses midnight. */
export function shiftWindow(s: ShiftTimes): { start: Date; end: Date } {
    const start = shiftMoment(s.shiftDate, s.shiftStart);
    const end = shiftMoment(s.shiftDate, s.shiftEnd);
    if (end.getTime() < start.getTime()) end.setDate(end.getDate() + 1);
    return { start, end };
}

export function shiftTemporalState(s: ShiftTimes, now: Date): ShiftTemporalState {
    const { start, end } = shiftWindow(s);
    const t = now.getTime();
    if (end.getTime() < t) return 'past';
    if (start.getTime() <= t) return 'current';
    return 'upcoming';
}

/** The LOCAL calendar date of `d` as 'YYYY-MM-DD' — never toISOString(), which is UTC. */
export function localDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Chronological: date, then start time. */
export function compareShifts(a: ShiftTimes, b: ShiftTimes): number {
    return shiftMoment(a.shiftDate, a.shiftStart).getTime() - shiftMoment(b.shiftDate, b.shiftStart).getTime();
}

/**
 * "The shift that is NOW" among today's shifts: the one running; else the next one to start today;
 * else the last one that ended today (so you can clock back into where you just were).
 * Status is deliberately ignored — a completed shift can be worked again (Florin: twice at one site).
 */
export function pickShiftNow<T extends ShiftTimes>(shifts: T[], now: Date): T | null {
    const today = localDateKey(now);
    const todays = shifts.filter(s => s.shiftDate === today).sort(compareShifts);
    if (!todays.length) return null;
    const current = todays.find(s => shiftTemporalState(s, now) === 'current');
    if (current) return current;
    const next = todays.find(s => shiftTemporalState(s, now) === 'upcoming');
    if (next) return next;
    return todays[todays.length - 1];
}
