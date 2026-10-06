/**
 * DOC-LOCK-1 · a quote the client has seen is a LOCKED document (Florin 2026-10-03: "sent quotes are blocked
 * documents"). Found: nothing enforced it — the status became 'opt-sent' and every line stayed editable, so the
 * record could silently differ from the PDF the client holds.
 *
 * CORE rule, pure, tested (tests/document-lock.test.ts); enforced by EVERY server write door (saveGlobalPage,
 * saveGlobalPagesBatch, updatePageServerFirst) next to export-lock.
 *   locked:          a quote that was SENT — its `sentAt` stamp (written by sending), or a sent / accepted /
 *                    rejected status (quotes sent before the stamp existed)
 *   still writable:  the STATUS — any status but draft (Florin 2026-10-06: "should be able to edit status on sent
 *                    quotes. does not affect the document just my shelving strategy"); the acceptance record the
 *                    client's signature writes, the archive fields, the link to a revision (revisedTo)
 *   never:           back to draft (that would reopen the document); `sentAt` removed once set
 *   frozen:          everything else — lines (blocks), prices, client, dates, texts
 * Changing a locked quote = "Revise": a new version (OFF-…-v2), the original stays as sent.
 */
import { ARCHIVE_FIELDS, areBlocksSemanticallyEqual } from './export-lock';

export const LOCKED_QUOTE_STATUSES: ReadonlySet<string> = new Set([
    'opt-sent', 'opt-accepted', 'opt-rejected', 'SENT', 'ACCEPTED', 'REJECTED', 'DECLINED',
]);

const WRITABLE_WHEN_LOCKED: ReadonlySet<string> = new Set([
    'status', 'statusChangedAt', 'expiredAt',
    'clientSignature', 'signatureMethod', 'consentName', 'signedAt', 'acceptedAt', 'rejectedAt',
    'revisedTo', 'sentAt', 'lastSentAt',
    ...ARCHIVE_FIELDS,
]);

/** A sent quote stays locked whatever its status says — the status is filing, the stamp is the fact. */
export function isQuoteLocked(properties: Record<string, unknown> | null | undefined): boolean {
    return !!properties?.sentAt || LOCKED_QUOTE_STATUSES.has(String(properties?.status ?? ''));
}

const DRAFT_STATUSES: ReadonlySet<string> = new Set(['opt-draft', 'draft', 'DRAFT', '']);

export interface DocumentLockViolation { blockedFields: string[] }

/** null = the write is allowed. Quotations are document-locked; on invoices only the document TYPE is (their content has the export lock). */
export function checkDocumentLock(
    role: string | null | undefined,
    existingProperties: unknown,
    incomingProperties: Record<string, unknown>,
    existingBlocks?: unknown,
    incomingBlocks?: unknown[],
): DocumentLockViolation | null {
    // PROFORMA-1 (Florin 2026-10-06: "the proforma and the invoice are two distinct docs"): an invoice / credit note /
    // proforma keeps the type it was created with — a proforma becomes an invoice by "Factureren", a new document.
    if (role === 'invoices') {
        const before = (existingProperties as Record<string, unknown> | null | undefined)?.docType;
        return 'docType' in incomingProperties && before && incomingProperties.docType !== before ? { blockedFields: ['docType'] } : null;
    }
    if (role !== 'quotations') return null;
    const existing = (existingProperties ?? {}) as Record<string, unknown>;
    if (!isQuoteLocked(existing)) return null;
    const blocked = Object.keys(incomingProperties).filter(k =>
        !WRITABLE_WHEN_LOCKED.has(k) && JSON.stringify(incomingProperties[k]) !== JSON.stringify(existing[k]));
    // The status is free (the office files its quotes) — but never back to draft (a change needs "Revise", a new
    // version), and a quote sent before the stamp existed may leave the sent statuses only once it carries `sentAt`
    // (otherwise the new status would unlock it).
    if ('status' in incomingProperties && incomingProperties.status !== existing.status) {
        const next = String(incomingProperties.status ?? '');
        const stamped = !!existing.sentAt || !!incomingProperties.sentAt;
        if (DRAFT_STATUSES.has(next) || (!stamped && !LOCKED_QUOTE_STATUSES.has(next))) blocked.push('status');
    }
    if (existing.sentAt && 'sentAt' in incomingProperties && !incomingProperties.sentAt) blocked.push('sentAt');
    if (incomingBlocks !== undefined && !areBlocksSemanticallyEqual(existingBlocks, incomingBlocks)) blocked.push('blocks');
    return blocked.length ? { blockedFields: blocked } : null;
}
