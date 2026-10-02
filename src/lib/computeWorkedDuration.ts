/**
 * Duration and break calculation for clock entries.
 * Centralises the logic used across UI, reporting, and exports.
 */

export interface WorkDuration {
    hours: number;
    minutes: number;
    totalMinutes: number;
    breakDeducted: boolean;
}

/**
 * Computes the duration worked between two timestamps, applying the canonical break rule.
 * 
 * Break Rule (canonical from ProjectDetailView.tsx):
 * If the shift is > 4 hours and noBreak is NOT checked, deduct 0.5 hours (30 minutes)
 * for a break.
 * 
 * @param clockIn - Start time
 * @param clockOut - End time (nullable; returns 0 if null)
 * @param noBreak - Whether the break deduction should be skipped
 * @returns WorkDuration object with the computed values
 */
export function computeWorkedDuration(
    clockIn: Date | string | null,
    clockOut: Date | string | null,
    noBreak: boolean
): WorkDuration {
    if (!clockIn || !clockOut) {
        return { hours: 0, minutes: 0, totalMinutes: 0, breakDeducted: false };
    }

    const start = new Date(clockIn).getTime();
    const end = new Date(clockOut).getTime();
    
    if (isNaN(start) || isNaN(end) || end < start) {
        return { hours: 0, minutes: 0, totalMinutes: 0, breakDeducted: false };
    }

    // Raw duration in minutes
    const rawTotalMinutes = Math.floor((end - start) / (1000 * 60));
    const rawHours = rawTotalMinutes / 60;

    let breakDeducted = false;
    let finalTotalMinutes = rawTotalMinutes;

    // Apply the > 4 hour break rule
    if (!noBreak && rawHours > 4) {
        breakDeducted = true;
        finalTotalMinutes = Math.max(0, rawTotalMinutes - 30);
    }

    const hours = Math.floor(finalTotalMinutes / 60);
    const minutes = finalTotalMinutes % 60;

    return {
        hours,
        minutes,
        totalMinutes: finalTotalMinutes,
        breakDeducted
    };
}

/**
 * Convenience formatter for the UI (e.g. "4h 30m")
 */
export function formatWorkDuration(duration: WorkDuration): string {
    if (duration.totalMinutes === 0) return "0h";
    if (duration.hours > 0 && duration.minutes > 0) {
        return `${duration.hours}h ${duration.minutes}m`;
    }
    if (duration.hours > 0) {
        return `${duration.hours}h`;
    }
    return `${duration.minutes}m`;
}

// ── Hours as numbers people read (Florin 2026-10-02) ──────────────────────────────────────────────
// ONE conversion for the screens, the exports and the invoice. Always from MINUTES: a total is the
// sum of minutes converted once — never a sum of already-rounded decimals (that drifts by cents).

/** Decimal hours, 2 places: 450 min → 7.5 · 440 min → 7.33. */
export function minutesToDecimalHours(totalMinutes: number): number {
    return Math.round((totalMinutes / 60) * 100) / 100;
}

/** "7,50" (nl/fr) · "7.50" (en) — always two decimals. */
export function formatDecimalHours(totalMinutes: number, locale = 'nl-BE'): string {
    return minutesToDecimalHours(totalMinutes).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "07:30" — hours can exceed 24 for totals ("37:30"). */
export function formatHoursMinutes(totalMinutes: number): string {
    const m = Math.max(0, Math.round(totalMinutes));
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
