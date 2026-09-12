/** Pure utility — no React, no side-effects. */

export type RecurrencePattern = 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly' | 'custom';

export type RepeatFromMode = 'due' | 'completion';

export interface RecurrenceRule {
    pattern: RecurrencePattern;
    interval: number;
    dayOfWeek?: number; // 0=Sun…6=Sat (weekly on specific day)
    raw: string;
    anchorDay?: number;
    repeatFrom?: RepeatFromMode;
}

export interface ParseSuccess extends RecurrenceRule {
    ok: true;
    rule: RecurrenceRule;
}

export interface ParseFailure {
    ok: false;
    reason: string;
    raw: string;
}

export type ParseRecurrenceResult = ParseSuccess | ParseFailure;

export interface RecurrenceOptions {
    anchorDay?: number;
    completionDate?: Date;
    repeatFrom?: RepeatFromMode;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseDayOfWeek(str: string): number | undefined {
    const idx = DAY_NAMES.indexOf(str.toLowerCase());
    return idx >= 0 ? idx : undefined;
}

export function parseRecurrenceRule(raw: string): ParseRecurrenceResult {
    if (!raw || !raw.trim()) {
        return { ok: false, reason: 'Recurrence rule cannot be empty', raw: raw ?? '' };
    }
    const cleanRaw = raw.trim();
    let s = cleanRaw.toLowerCase();

    let repeatFrom: RepeatFromMode = 'due';
    if (s.includes('after completion') || s.includes('from completion')) {
        repeatFrom = 'completion';
        s = s.replace(/\s+(after|from)\s+completion\b/, '').trim();
    }

    // Check interval 0 early
    const zeroMatch = s.match(/\b0\s+(days?|weeks?|months?|years?)\b/);
    if (zeroMatch || s === 'every 0 days' || s === 'every 0 weeks' || s === 'every 0 months' || s === 'every 0 years') {
        return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw };
    }

    const buildSuccess = (pattern: RecurrencePattern, interval: number, dayOfWeek?: number): ParseSuccess => {
        if (interval < 1) {
            return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw } as any;
        }
        const rule: RecurrenceRule = {
            pattern,
            interval,
            dayOfWeek,
            raw: cleanRaw,
            repeatFrom,
        };
        return {
            ok: true,
            rule,
            ...rule,
        };
    };

    if (s === 'every day' || s === 'daily')               return buildSuccess('daily', 1);
    if (s === 'every weekday' || s === 'weekdays')         return buildSuccess('weekdays', 1);
    if (s === 'every week' || s === 'weekly')              return buildSuccess('weekly', 1);
    if (s === 'every month' || s === 'monthly')            return buildSuccess('monthly', 1);
    if (s === 'every year'  || s === 'yearly' || s === 'annually') return buildSuccess('yearly', 1);

    // Named weekday: "every tuesday", "tuesday", "weekly on tuesday"
    for (let i = 0; i < DAY_NAMES.length; i++) {
        if (s === `every ${DAY_NAMES[i]}` || s === DAY_NAMES[i] || s === `weekly on ${DAY_NAMES[i]}` || s === `every week on ${DAY_NAMES[i]}`) {
            return buildSuccess('weekly', 1, i);
        }
    }

    // "every N weeks on <day>"
    const nwDay = s.match(/^every\s+(\d+)\s+weeks?\s+on\s+([a-z]+)$/);
    if (nwDay) {
        const interval = parseInt(nwDay[1], 10);
        if (interval < 1) return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw };
        const day = parseDayOfWeek(nwDay[2]);
        if (day !== undefined) {
            return buildSuccess('weekly', interval, day);
        }
    }

    const nd = s.match(/^every\s+(\d+)\s+days?$/);
    if (nd) {
        const interval = parseInt(nd[1], 10);
        if (interval < 1) return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw };
        return buildSuccess('custom', interval);
    }

    const nw = s.match(/^every\s+(\d+)\s+weeks?$/);
    if (nw) {
        const interval = parseInt(nw[1], 10);
        if (interval < 1) return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw };
        return buildSuccess('weekly', interval);
    }

    const nm = s.match(/^every\s+(\d+)\s+months?$/);
    if (nm) {
        const interval = parseInt(nm[1], 10);
        if (interval < 1) return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw };
        return buildSuccess('monthly', interval);
    }

    const ny = s.match(/^every\s+(\d+)\s+years?$/);
    if (ny) {
        const interval = parseInt(ny[1], 10);
        if (interval < 1) return { ok: false, reason: 'Interval must be at least 1', raw: cleanRaw };
        return buildSuccess('yearly', interval);
    }

    return {
        ok: false,
        reason: `Unrecognized recurrence pattern: "${cleanRaw}"`,
        raw: cleanRaw,
    };
}

export function getNextDueDate(
    ruleOrResult: RecurrenceRule | ParseRecurrenceResult,
    from: Date,
    options?: RecurrenceOptions
): Date {
    let rule: RecurrenceRule;
    if ('ok' in ruleOrResult) {
        if (!ruleOrResult.ok) {
            throw new Error(`Cannot calculate next due date from invalid rule: ${ruleOrResult.reason}`);
        }
        rule = ruleOrResult.rule || ruleOrResult;
    } else {
        rule = ruleOrResult;
    }

    if (!rule.interval || rule.interval < 1) {
        throw new Error(`Interval must be at least 1, received ${rule.interval}`);
    }

    // Repeat anchor: completion vs due
    const repeatMode = options?.repeatFrom ?? rule.repeatFrom ?? 'due';
    let baseDate = from;
    if (repeatMode === 'completion' && options?.completionDate) {
        baseDate = options.completionDate;
    }

    const d = new Date(baseDate);
    if (rule.anchorDay === undefined && options?.anchorDay !== undefined) {
        rule.anchorDay = options.anchorDay;
    } else if (rule.anchorDay === undefined) {
        rule.anchorDay = baseDate.getDate();
    }
    const anchorDay = options?.anchorDay ?? rule.anchorDay;

    switch (rule.pattern) {
        case 'daily':
        case 'custom':
            d.setDate(d.getDate() + rule.interval);
            break;

        case 'weekdays': {
            let added = 0;
            while (added < rule.interval) {
                d.setDate(d.getDate() + 1);
                const day = d.getDay();
                if (day !== 0 && day !== 6) {
                    added++;
                }
            }
            break;
        }

        case 'weekly': {
            if (rule.dayOfWeek !== undefined) {
                if (d.getDay() === rule.dayOfWeek) {
                    d.setDate(d.getDate() + 7 * rule.interval);
                } else {
                    const daysUntil = (rule.dayOfWeek - d.getDay() + 7) % 7;
                    d.setDate(d.getDate() + daysUntil);
                }
            } else {
                d.setDate(d.getDate() + 7 * rule.interval);
            }
            break;
        }

        case 'monthly': {
            const targetTotalMonths = d.getFullYear() * 12 + d.getMonth() + rule.interval;
            const targetYear = Math.floor(targetTotalMonths / 12);
            const targetMonth = targetTotalMonths % 12;
            const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            const targetDay = Math.min(anchorDay, daysInTargetMonth);

            d.setFullYear(targetYear, targetMonth, targetDay);
            break;
        }

        case 'yearly': {
            const targetYear = d.getFullYear() + rule.interval;
            const targetMonth = d.getMonth();
            const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            const targetDay = Math.min(anchorDay, daysInTargetMonth);

            d.setFullYear(targetYear, targetMonth, targetDay);
            break;
        }
    }

    return d;
}

export function getNextDueAfter(
    ruleOrResult: RecurrenceRule | ParseRecurrenceResult,
    from: Date,
    notBefore: Date,
    options?: RecurrenceOptions
): Date {
    let rule: RecurrenceRule;
    if ('ok' in ruleOrResult) {
        if (!ruleOrResult.ok) {
            throw new Error(`Cannot calculate next due date from invalid rule: ${ruleOrResult.reason}`);
        }
        rule = ruleOrResult.rule || ruleOrResult;
    } else {
        rule = ruleOrResult;
    }

    if (!rule.interval || rule.interval < 1) {
        throw new Error(`Interval must be at least 1, received ${rule.interval}`);
    }

    const anchorDay = options?.anchorDay ?? rule.anchorDay ?? from.getDate();
    let current = new Date(from);
    let iterations = 0;
    const MAX_ITERATIONS = 500;

    while (current <= notBefore) {
        if (++iterations > MAX_ITERATIONS) {
            throw new Error(`getNextDueAfter exceeded maximum iterations (${MAX_ITERATIONS})`);
        }
        current = getNextDueDate(rule, current, { ...options, anchorDay });
    }

    return current;
}

export function formatRecurrence(ruleOrResult: RecurrenceRule | ParseRecurrenceResult): string {
    if ('raw' in ruleOrResult) {
        return ruleOrResult.raw;
    }
    return '';
}
