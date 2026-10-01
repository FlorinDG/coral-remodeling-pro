/**
 * SCH-8 · "this and following" / "all in series" — done on the SERVER, in one statement, never a
 * client loop (a half-edited series cannot be told apart from a whole one).
 *
 * A series is the set of shifts created together (`seriesId`) — since 2026-10-01 also the work
 * order: several days and/or several crew. Rules (Planner, deciding what SCH-8 left open):
 *   - always scoped by tenantId — seriesId is 7 random chars, NOT unique across tenants;
 *   - submitted shifts are closed: never changed or deleted by a series action;
 *   - per-occurrence fields are never copied series-wide: the date (it would collapse every
 *     occurrence onto one day), the worker (a team's shifts would all become one person's),
 *     the status, the crew's own note, the series id itself;
 *   - delete never removes a shift that already has hours on it — those are reported as kept.
 */
import type { Prisma } from '@prisma/client';

export type SeriesScope = 'occurrence' | 'following' | 'series';

export function parseScope(v: string | null | undefined): SeriesScope {
    return v === 'following' || v === 'series' ? v : 'occurrence';
}

/** Fields that may be copied to every shift of the series. Everything else stays per shift. */
export const SERIES_FIELDS = [
    'shiftStart', 'shiftEnd', 'shiftName', 'projectId', 'contactPageId', 'role', 'notes',
    'siteAddress', 'materialsEnabled',
] as const;

export function seriesData(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of SERIES_FIELDS) if (k in data) out[k] = data[k];
    return out;
}

/** The OTHER shifts a series action reaches (the anchor itself is handled by the normal path). */
export function seriesWhere(
    tenantId: string,
    anchor: { id: string; seriesId: string | null; shiftDate: string },
    scope: SeriesScope,
): Prisma.ScheduledShiftWhereInput | null {
    if (scope === 'occurrence' || !anchor.seriesId) return null;
    return {
        tenantId,
        seriesId: anchor.seriesId,
        id: { not: anchor.id },
        status: { notIn: ['completed', 'Completed'] },
        ...(scope === 'following' ? { shiftDate: { gte: anchor.shiftDate } } : {}),
    };
}
