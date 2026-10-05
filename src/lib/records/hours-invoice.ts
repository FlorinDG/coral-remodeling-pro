/**
 * TS-INV-2 · a draft invoice from selected hours — what is PREFILLED, never imposed. Pure, tested
 * (tests/hours-invoice.test.ts).
 *
 * Florin 2026-10-05: "drop the hour rate modal, will get set manually in the invoice editor, and also drop the
 * project check, there is a select in the editor. invoicing is one of the processes where automation needs not
 * be full, not primate over human input, for legal and financial liability reasons."
 * So: no rate asked (lines at 0, priced in the editor); hours without a project, or of several clients, no longer
 * refuse — the client / project are prefilled only when the hours point at exactly ONE, else left to the editor.
 */

export interface HoursEntry { userId: string; projectId: string | null; date: string; minutes: number }

/** Client and project to PREFILL: only when every hour points at the same one; otherwise null (chosen in the editor). */
export function prefillParties(entries: Array<{ projectId: string | null }>, clientOf: (projectId: string) => string | null | undefined): { clientId: string | null; projectId: string | null } {
    if (!entries.length || entries.some(e => !e.projectId)) return { clientId: null, projectId: null };
    const projects = Array.from(new Set(entries.map(e => e.projectId as string)));
    const clients = new Set(projects.map(p => clientOf(p) || ''));
    const clientId = clients.size === 1 && !clients.has('') ? Array.from(clients)[0] : null;
    return { clientId, projectId: projects.length === 1 ? projects[0] : null };
}

/** One line per worker per (Brussels) day — `date` is already the business date. Sorted by date, then worker. */
export function hoursPerWorkerDay(entries: HoursEntry[], nameOf: (userId: string) => string): Array<{ userId: string; date: string; minutes: number; name: string }> {
    const lines = new Map<string, { userId: string; date: string; minutes: number; name: string }>();
    for (const e of entries) {
        const key = `${e.date}|${e.userId}`;
        const l = lines.get(key) || { userId: e.userId, date: e.date, minutes: 0, name: nameOf(e.userId) };
        l.minutes += e.minutes;
        lines.set(key, l);
    }
    return Array.from(lines.values()).sort((x, y) => x.date.localeCompare(y.date) || x.name.localeCompare(y.name));
}
