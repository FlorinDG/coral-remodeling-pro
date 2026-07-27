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
