/**
 * SCHED-WINDOW-1 · which shifts a screen loads — a window of calendar days, never all of history.
 *
 * Before 2026-10-10 the scheduler, the crew's clock button and MySchedule each loaded EVERY shift the tenant ever
 * had (with a 9 s timeout): an outage that grew with the data. Every surface now asks for its window; the door
 * (api/hr/[entity] GET shifts) applies it, and without a range it applies DEFAULT_WINDOW — still bounded.
 * Pure: calendar days 'YYYY-MM-DD' only (kernel addDaysYmd), no Date, no zone.
 */
import { addDaysYmd, isCalendarDay } from '@/lib/kernel/shift-time';

export interface DayWindow { from: string; to: string }

export type ShiftSurface =
    /** The office matrix / table: the weeks on screen ± one week (copy-previous-week reads the week before). */
    | { kind: 'planner'; weekStart: string; weeks: number }
    /** The crew: the clock button (today's shift, a night shift from yesterday), MySchedule (−7 … +14), the day summary. */
    | { kind: 'crew' }
    /** A late entry: the shifts it may still be linked to. */
    | { kind: 'late-entry' };

/** What a request without a range gets (the door's default). */
export const DEFAULT_WINDOW = { back: 31, ahead: 90 } as const;
/** No window is ever wider than this (a malformed or hostile range is refused, not served). */
export const MAX_WINDOW_DAYS = 400;

export function shiftWindow(surface: ShiftSurface, today: string): DayWindow {
    switch (surface.kind) {
        case 'planner': return { from: addDaysYmd(surface.weekStart, -7), to: addDaysYmd(surface.weekStart, surface.weeks * 7 + 6) };
        case 'crew': return { from: addDaysYmd(today, -8), to: addDaysYmd(today, 28) };
        case 'late-entry': return { from: addDaysYmd(today, -31), to: today };
    }
}

export function defaultWindow(today: string): DayWindow {
    return { from: addDaysYmd(today, -DEFAULT_WINDOW.back), to: addDaysYmd(today, DEFAULT_WINDOW.ahead) };
}

function daysBetween(from: string, to: string): number {
    // Count by stepping — the windows are small (≤ MAX_WINDOW_DAYS); stops as soon as it is too wide.
    let n = 0, d = from;
    while (d < to && n <= MAX_WINDOW_DAYS) { d = addDaysYmd(d, 1); n++; }
    return n;
}

/**
 * A requested range (query strings) → the window to apply, the default, or a refusal.
 * Both or neither: one bound alone is malformed.
 */
export function requestedWindow(from: string | null, to: string | null, today: string): { ok: true; window: DayWindow } | { ok: false; error: string } {
    if (!from && !to) return { ok: true, window: defaultWindow(today) };
    if (!isCalendarDay(from) || !isCalendarDay(to)) return { ok: false, error: 'invalid_range: from and to are calendar days YYYY-MM-DD' };
    if (from > to) return { ok: false, error: 'invalid_range: from is after to' };
    if (daysBetween(from, to) > MAX_WINDOW_DAYS) return { ok: false, error: `invalid_range: wider than ${MAX_WINDOW_DAYS} days` };
    return { ok: true, window: { from, to } };
}
