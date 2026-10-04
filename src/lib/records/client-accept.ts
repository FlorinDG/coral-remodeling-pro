/**
 * Who may ACCEPT a document from its public link — pure, tested (tests/client-accept.test.ts).
 *
 * The public quote / invoice page is opened by its id: the link is the key, by design. Before 2026-10-04
 * (R2-1-CENSUS #9/#10) acceptance checked nothing else — any record id (an article, a project, another
 * tenant's anything) could be set to ACCEPTED with a signature, and a "quote" acceptance created a project.
 * Now: only a record of the right KIND (its database's logicalKey) that was actually SENT.
 */
export type AcceptKind = 'invoices' | 'quotations';

/** Sent, and not yet answered. Drafts were never sent; accepted / rejected are answered. */
const ACCEPTABLE_STATUSES = new Set(['opt-sent', 'SENT']);

export type AcceptRefusal = 'not_found' | 'wrong_kind' | 'already_accepted' | 'not_sent';

export function clientAcceptRefusal(kind: AcceptKind, logicalKey: string | null | undefined, status: unknown): AcceptRefusal | null {
    if (logicalKey !== kind) return 'wrong_kind';
    if (status === 'ACCEPTED' || status === 'opt-accepted') return 'already_accepted';
    if (typeof status !== 'string' || !ACCEPTABLE_STATUSES.has(status)) return 'not_sent';
    return null;
}
