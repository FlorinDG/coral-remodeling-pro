/**
 * TS-PERIOD-1 · a period of BUSINESS days ('YYYY-MM-DD' to 'YYYY-MM-DD', Brussels) over instants — one rule for every
 * hours screen and export. Pure.
 *
 * `new Date('2026-10-31')` is UTC midnight: `lte` of it dropped the whole last day of the period, and `gte` of the
 * first day missed Brussels 00:00–02:00. The database is asked for a window widened by a day on each side (whole UTC
 * days — no offset arithmetic); each instant is then kept by its Brussels date (zonedParts).
 */
import { addDaysYmd, zonedParts } from '../kernel/shift-time';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export interface BusinessPeriod { from: string | null; to: string | null }

/** The period from query params — anything that is not a 'YYYY-MM-DD' is no bound. */
export function businessPeriod(from: string | null | undefined, to: string | null | undefined): BusinessPeriod {
    return { from: from && YMD.test(from) ? from : null, to: to && YMD.test(to) ? to : null };
}

/** The widened window for the database (`clockInTime` filter), or null when the period is unbounded. */
export function periodQueryWindow(p: BusinessPeriod): { gte?: Date; lt?: Date } | null {
    if (!p.from && !p.to) return null;
    return {
        ...(p.from ? { gte: new Date(`${addDaysYmd(p.from, -1)}T00:00:00Z`) } : {}),
        ...(p.to ? { lt: new Date(`${addDaysYmd(p.to, 2)}T00:00:00Z`) } : {}),
    };
}

/** Is this instant on a business day inside the period? */
export function inBusinessPeriod(instant: Date | string, p: BusinessPeriod): boolean {
    const day = zonedParts(instant).date;
    return (!p.from || day >= p.from) && (!p.to || day <= p.to);
}
