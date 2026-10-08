/**
 * LIVE-1 · has a database changed since this screen read it? Pure, tested (tests/database-version.test.ts).
 * Florin 2026-10-08: a receipt photographed on the phone did not appear on the desktop "Te valideren" screen, open in
 * front of him, until a refresh — a screen read its database once. The server answers a cheap question (how many
 * records, when was the last change); a different answer means the screen re-reads.
 */
export interface DatabaseVersion { count: number; lastUpdatedAt: string | null }

/** The version of a list of records as the screen holds them (count + newest change). */
export function versionOf(pages: Array<{ updatedAt?: string | Date | null }>): DatabaseVersion {
    let last: number | null = null;
    for (const p of pages) {
        const t = p.updatedAt ? new Date(p.updatedAt).getTime() : NaN;
        if (Number.isFinite(t) && (last === null || t > last)) last = t;
    }
    return { count: pages.length, lastUpdatedAt: last === null ? null : new Date(last).toISOString() };
}

/** A record added, deleted or changed elsewhere → the versions differ. */
export function versionChanged(seen: DatabaseVersion | undefined, now: DatabaseVersion): boolean {
    if (!seen) return false;   // never read here — nothing to compare
    return seen.count !== now.count || seen.lastUpdatedAt !== now.lastUpdatedAt;
}
