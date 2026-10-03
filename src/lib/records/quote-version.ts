/**
 * DOC-LOCK-1 · "Revise" numbering — pure, tested. Florin 2026-10-03: a new version, SAME number:
 * OFF-2026-042 → OFF-2026-042-v2 → -v3 … The base is the number without its -vN suffix.
 */
export function baseNumber(title: string): string {
    return String(title || '').replace(/-v\d+$/i, '');
}

/** The next version number for `base`, given the titles of the quotes that exist. */
export function nextVersion(base: string, existingTitles: string[]): number {
    let max = 1;   // the original is version 1
    const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-v(\\d+)$`, 'i');
    for (const t of existingTitles) {
        const m = re.exec(String(t || ''));
        if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
}
