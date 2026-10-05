/**
 * WO-4b · the signed work order's STATUS, assembled from its append-only facts (AuditLog on the shifts):
 *   'sign'          the client's signature (frozen evidence: signer, time, number) — on every member shift
 *   'werkbon-pdf'   the PDF, stored once (key, fileName) — on the anchor shift
 *   'werkbon-sent'  each manual send (to, cc, sentAt) — on the anchor shift (WO-4b M3)
 * Pure, tested (tests/werkbon-status.test.ts). Florin 2026-10-05: the signed document is shown on its own, labelled,
 * apart from the attachments, with its sending status and recipients; the signature is never a separate file.
 */

export interface WerkbonFacts {
    sign?: { after: unknown; createdAt?: string | Date } | null;
    pdf?: { after: unknown } | null;
    sent?: Array<{ after: unknown; createdAt?: string | Date }>;
}

export interface WerkbonSend { at: string; to: string[]; cc: string[] }

export interface WerkbonStatus {
    number: string | null;
    signerName: string;
    signedAt: string;
    pdf: { key: string; fileName: string } | null;
    sends: WerkbonSend[];            // oldest first
    state: 'pdf_pending' | 'not_sent' | 'sent';
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v));

/** Null when the work order is not signed. */
export function werkbonStatus(f: WerkbonFacts): WerkbonStatus | null {
    const s = (f.sign?.after || null) as Record<string, unknown> | null;
    if (!s || !str(s.signerName)) return null;
    const p = (f.pdf?.after || null) as Record<string, unknown> | null;
    const pdf = p && str(p.key) ? { key: str(p.key), fileName: str(p.fileName) || str(p.key).split('/').pop() || 'werkbon.pdf' } : null;
    const sends = (f.sent || [])
        .map(r => { const a = (r.after || {}) as Record<string, unknown>; return { at: str(a.sentAt) || iso(r.createdAt), to: list(a.to), cc: list(a.cc) }; })
        .filter(x => x.to.length > 0)
        .sort((a, b) => a.at.localeCompare(b.at));
    return {
        number: str(s.number) || null,
        signerName: str(s.signerName),
        signedAt: str(s.signedAt) || iso(f.sign?.createdAt),
        pdf,
        sends,
        state: !pdf ? 'pdf_pending' : sends.length ? 'sent' : 'not_sent',
    };
}

/**
 * Attachments that are NOT ordinary attachments: the signed PDF (shown in its own block) and the legacy signature
 * image (before 2026-10-05 signing also attached "Handtekening — <name>.png"; the signature is no longer a file).
 */
export function isWerkbonArtifact(att: { name?: string | null; url?: string | null }, isWerkbonFile: (n: string | null | undefined) => boolean): boolean {
    const name = att.name || '';
    return isWerkbonFile(name) || /^Handtekening — .+\.png$/.test(name);
}
