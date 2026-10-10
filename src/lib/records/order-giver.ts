/**
 * END-CLIENT-1 · who ordered the work on a shift (Florin 2026-10-04): the shift's own client (contactPageId), else
 * the client of its project (`prop-client` on the project page). Written once — the werkbon, the timesheet's shift
 * details and the shift editor's "the project's client" all mean this. Pure.
 */
export function orderGiverIdOf(shiftContactPageId: string | null | undefined, projectProperties: unknown): string | null {
    if (shiftContactPageId) return shiftContactPageId;
    const v = (projectProperties as Record<string, unknown> | null)?.['prop-client'];
    if (Array.isArray(v)) return typeof v[0] === 'string' && v[0] ? v[0] : null;
    return typeof v === 'string' && v ? v : null;
}
