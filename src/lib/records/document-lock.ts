/**
 * DOC-LOCK-1 · a quote the client has seen is a LOCKED document (Florin 2026-10-03: "sent quotes are blocked
 * documents"). Found: nothing enforced it — the status became 'opt-sent' and every line stayed editable, so the
 * record could silently differ from the PDF the client holds.
 *
 * CORE rule, pure, tested (tests/document-lock.test.ts); enforced by EVERY server write door (saveGlobalPage,
 * saveGlobalPagesBatch, updatePageServerFirst) next to export-lock.
 *   locked statuses: sent · accepted · rejected (Florin: sent, accepted, declined)
 *   still writable:  the status — only to another locked status (never back to draft), the acceptance record the
 *                    client's signature writes, the archive fields, the link to a revision (revisedTo)
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

export function isQuoteLocked(properties: Record<string, unknown> | null | undefined): boolean {
    return LOCKED_QUOTE_STATUSES.has(String(properties?.status ?? ''));
}

export interface DocumentLockViolation { blockedFields: string[] }

/** null = the write is allowed. Only quotations are document-locked (invoices have their own export lock). */
export function checkDocumentLock(
    role: string | null | undefined,
    existingProperties: unknown,
    incomingProperties: Record<string, unknown>,
    existingBlocks?: unknown,
    incomingBlocks?: unknown[],
): DocumentLockViolation | null {
    if (role !== 'quotations') return null;
    const existing = (existingProperties ?? {}) as Record<string, unknown>;
    if (!isQuoteLocked(existing)) return null;
    const blocked = Object.keys(incomingProperties).filter(k =>
        !WRITABLE_WHEN_LOCKED.has(k) && JSON.stringify(incomingProperties[k]) !== JSON.stringify(existing[k]));
    // The status may move only to ANOTHER locked status (sent → accepted / rejected) — back to draft would
    // unlock the document; a change needs "Revise" (a new version).
    if ('status' in incomingProperties && incomingProperties.status !== existing.status
        && !LOCKED_QUOTE_STATUSES.has(String(incomingProperties.status ?? ''))) blocked.push('status');
    if (incomingBlocks !== undefined && !areBlocksSemanticallyEqual(existingBlocks, incomingBlocks)) blocked.push('blocks');
    return blocked.length ? { blockedFields: blocked } : null;
}
