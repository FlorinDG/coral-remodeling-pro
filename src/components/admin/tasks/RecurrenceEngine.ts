/** Pure utility — no React, no side-effects. */

export type RecurrencePattern = 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly' | 'custom';

export interface RecurrenceRule {
    pattern: RecurrencePattern;
    interval: number;
    dayOfWeek?: number; // 0=Sun…6=Sat (weekly on specific day)
    raw: string;
}

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

export function parseRecurrenceRule(raw: string): RecurrenceRule | null {
    if (!raw?.trim()) return null;
    const s = raw.trim().toLowerCase();

    if (s === 'every day' || s === 'daily')               return { pattern: 'daily',    interval: 1, raw };
    if (s === 'every weekday' || s === 'weekdays')         return { pattern: 'weekdays', interval: 1, raw };
    if (s === 'every week' || s === 'weekly')              return { pattern: 'weekly',   interval: 1, raw };
    if (s === 'every month' || s === 'monthly')            return { pattern: 'monthly',  interval: 1, raw };
    if (s === 'every year'  || s === 'yearly' || s === 'annually') return { pattern: 'yearly', interval: 1, raw };

    for (let i = 0; i < DAY_NAMES.length; i++) {
        if (s === `every ${DAY_NAMES[i]}` || s === DAY_NAMES[i])
            return { pattern: 'weekly', interval: 1, dayOfWeek: i, raw };
    }

    const nd = s.match(/^every\s+(\d+)\s+days?$/);
    if (nd) return { pattern: 'custom',  interval: +nd[1], raw };

    const nw = s.match(/^every\s+(\d+)\s+weeks?$/);
    if (nw) return { pattern: 'weekly',  interval: +nw[1], raw };

    const nm = s.match(/^every\s+(\d+)\s+months?$/);
    if (nm) return { pattern: 'monthly', interval: +nm[1], raw };

    return null;
}

export function getNextDueDate(rule: RecurrenceRule, from: Date): Date {
    const d = new Date(from);
    switch (rule.pattern) {
        case 'daily':    d.setDate(d.getDate() + rule.interval); break;
        case 'custom':   d.setDate(d.getDate() + rule.interval); break;
        case 'monthly':  d.setMonth(d.getMonth() + rule.interval); break;
        case 'yearly':   d.setFullYear(d.getFullYear() + rule.interval); break;
        case 'weekdays':
            d.setDate(d.getDate() + 1);
            while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
            break;
        case 'weekly':
            if (rule.dayOfWeek !== undefined) {
                d.setDate(d.getDate() + 1);
                while (d.getDay() !== rule.dayOfWeek) d.setDate(d.getDate() + 1);
            } else {
                d.setDate(d.getDate() + 7 * rule.interval);
            }
            break;
    }
    return d;
}

export function formatRecurrence(rule: RecurrenceRule): string {
    return rule.raw;
}
