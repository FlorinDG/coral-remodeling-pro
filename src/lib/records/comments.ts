/**
 * COMMENTS-1 · a thread on a record (Florin 2026-10-05: "like implemented in click-up. universally available, part
 * of the db schema, and usage by making it available in the view"). Pure, tested (tests/comments.test.ts).
 * Internal only — never in the client portal. Mentions are written as `@[Name](userId)` by the composer.
 */

export const COMMENT_MAX = 5000;
export const COMMENTS_FIELD_ID = 'comments';

const MENTION = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,64})\)/g;

/** The user ids mentioned in a body (unique, only ids that are this tenant's users). */
export function mentionedIds(body: string, tenantUserIds: Iterable<string>): string[] {
    const allowed = new Set(tenantUserIds);
    const out: string[] = [];
    for (const m of body.matchAll(MENTION)) if (allowed.has(m[2]) && !out.includes(m[2])) out.push(m[2]);
    return out;
}

/** The body as plain text ("@Name") — for the grid cell, notifications, exports. */
export function plainText(body: string): string {
    return body.replace(MENTION, '@$1');
}

/** A body that may be stored: trimmed, non-empty, within the limit. Null = refuse. */
export function cleanBody(body: unknown): string | null {
    if (typeof body !== 'string') return null;
    const b = body.replace(/\r\n/g, '\n').trim();
    return b.length === 0 || b.length > COMMENT_MAX ? null : b;
}

export interface CommentLike { id: string; authorId: string; deletedAt?: Date | string | null; resolvedAt?: Date | string | null; createdAt: Date | string; body: string }
export interface Actor { userId: string; isAdmin: boolean }
export type CommentAction = 'edit' | 'delete' | 'resolve';

/** Who may do what: edit — the author only; delete — the author or a tenant admin; resolve — anyone in the office. */
export function commentRefusal(action: CommentAction, c: CommentLike | null, actor: Actor): 'not_found' | 'deleted' | 'not_author' | null {
    if (!c) return 'not_found';
    if (c.deletedAt) return 'deleted';
    if (action === 'edit' && c.authorId !== actor.userId) return 'not_author';
    if (action === 'delete' && c.authorId !== actor.userId && !actor.isAdmin) return 'not_author';
    return null;
}

export interface LatestComment { id: string; body: string; authorId: string; createdAt: string; count: number; open: number; mentions: boolean }

/** What the "Opmerkingen" field shows for a record: the most recent live comment, the count, the unresolved count. */
export function latestComment(comments: CommentLike[]): LatestComment | null {
    const live = comments.filter(c => !c.deletedAt);
    if (!live.length) return null;
    const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : String(d));
    const last = live.reduce((a, b) => (iso(b.createdAt) > iso(a.createdAt) ? b : a));
    return {
        id: last.id, body: plainText(last.body), authorId: last.authorId, createdAt: iso(last.createdAt),
        count: live.length, open: live.filter(c => !c.resolvedAt).length, mentions: new RegExp(MENTION.source).test(last.body),
    };
}

/**
 * The grid's in-place edit of the "Opmerkingen" cell (Florin 2026-10-05: "text only. should be able to edit in place").
 * Your OWN latest comment is edited; anything else — someone else's comment, a comment with @mentions (the cell holds
 * plain text, an edit would strip them), no comment yet — makes the typed text a NEW comment. Someone else's words are
 * never overwritten from a cell.
 */
export type InPlaceEdit = { kind: 'edit'; id: string; text: string } | { kind: 'add'; text: '' };

export function inPlaceEdit(latest: Pick<LatestComment, 'id' | 'authorId' | 'body' | 'mentions'> | null | undefined, userId: string | null | undefined): InPlaceEdit {
    if (latest && userId && latest.authorId === userId && !latest.mentions) return { kind: 'edit', id: latest.id, text: latest.body };
    return { kind: 'add', text: '' };
}
