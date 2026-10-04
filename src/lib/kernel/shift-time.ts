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
 * Status is not consulted here — callers that CLOCK decide which shifts are eligible (a submitted
 * shift is closed; one worked earlier today but not yet submitted can be worked again).
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

/**
 * Florin, 2026-09-30: "no shift should be completed until manually submitted by crew member.
 * this guarantees complete capture and accountability." A shift is completed ONLY by the
 * submit action (lib/data/shift-submit.ts) — never by clock-out, tasks, or creation.
 * Legacy rows carry 'Completed' (capitalised) — both spellings read as submitted.
 */
export function isShiftSubmitted(status: string | null | undefined): boolean {
    return (status || '').toLowerCase() === 'completed';
}

// ── SERVER-SIDE LOCAL TIME ────────────────────────────────────────────────────
/**
 * The business's wall clock. The server runs in UTC (Vercel); any "date" or "HH:mm" it derives
 * from an instant with toISOString() or date-fns format() is UTC — two hours early in a Belgian
 * summer, and the previous day before 02:00. Both tenants are Belgian today.
 * Next step (recorded): a per-tenant timezone setting.
 */
export const BUSINESS_TIME_ZONE = 'Europe/Brussels';

/**
 * An instant → its wall-clock date and time IN A NAMED ZONE. Uses Intl with the zone, never an
 * offset (pd.md: no offset arithmetic) — daylight saving is the zone database's job.
 */
export function zonedParts(instant: Date | string, timeZone: string = BUSINESS_TIME_ZONE): { date: string; time: string } {
    const d = typeof instant === 'string' ? new Date(instant) : instant;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

// ── ENTRY ↔ SHIFT MATCHING (SHIFT-LINK-1) ─────────────────────────────────────
/**
 * Florin 2026-10-01: "if you can map them correctly, the app can fix them, otherwise … suggestion,
 * editable". Matching is done in WALL-CLOCK minutes of one local date — the entry's instants are
 * turned into Brussels date + HH:mm (zonedParts), the shift is already stored that way. No Date is
 * built from shift strings on the server (it runs in UTC).
 */
export interface LocalSpan { date: string; start: string; end: string }

const toMin = (hhmm: string) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Minutes of overlap between a recorded span and a shift on the same local date (overnight shifts handled). */
export function overlapMinutes(span: LocalSpan, shift: ShiftTimes): number {
    if (span.date !== shift.shiftDate) return 0;
    const s0 = toMin(span.start); let s1 = toMin(span.end); if (s1 <= s0) s1 += 24 * 60;
    const h0 = toMin(shift.shiftStart); let h1 = toMin(shift.shiftEnd); if (h1 <= h0) h1 += 24 * 60;
    return Math.max(0, Math.min(s1, h1) - Math.max(s0, h0));
}

/**
 * `unique` — the ONE shift the span overlaps (safe to link automatically), else null.
 * `ranked` — every shift of that date, most overlap first (the editable suggestion's options,
 * the first being the suggestion when it overlaps at all).
 */
export function matchSpanToShifts<T extends ShiftTimes>(span: LocalSpan, shifts: T[]): { unique: T | null; ranked: Array<{ shift: T; overlap: number }> } {
    const ranked = shifts
        .filter(s => s.shiftDate === span.date)
        .map(shift => ({ shift, overlap: overlapMinutes(span, shift) }))
        .sort((a, b) => b.overlap - a.overlap || compareShifts(a.shift, b.shift));
    const overlapping = ranked.filter(r => r.overlap > 0);
    return { unique: overlapping.length === 1 ? overlapping[0].shift : null, ranked };
}

/** A recorded entry's local span (Brussels wall clock) — closed entries only. */
export function entrySpan(clockIn: Date | string, clockOut: Date | string, timeZone: string = BUSINESS_TIME_ZONE): LocalSpan {
    const a = zonedParts(clockIn, timeZone); const b = zonedParts(clockOut, timeZone);
    return { date: a.date, start: a.time, end: b.date === a.date ? b.time : '24:00' };
}
