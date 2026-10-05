/**
 * COMMENTS-1 · the thread on a record — the core door. Every read and write on the caller's scoped client (the
 * session's tenant); rules in lib/records/comments.ts. A record is reachable only through its database's tenant
 * (GlobalPage is scoped via its database), so a comment can never land on another tenant's record.
 */
import type { TenantScopedClient } from '@/lib/data/scope';
import { cleanBody, commentRefusal, latestComment, mentionedIds, plainText, type Actor, type LatestComment } from '@/lib/records/comments';
import { notify } from '@/lib/notifications';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import { isWorkforceRole } from '@/lib/roles';

export interface CommentView {
    id: string; body: string; authorId: string; authorName: string;
    createdAt: string; editedAt: string | null; resolvedAt: string | null; resolvedBy: string | null; mine: boolean;
}

type Ctx = { db: TenantScopedClient; tenantId: string; actor: Actor };

async function userNames(db: TenantScopedClient, ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const users = await db.user.findMany({ where: { id: { in: Array.from(new Set(ids)) } }, select: { id: true, name: true, email: true } });
    return new Map(users.map(u => [u.id, u.name || u.email || '—']));
}

/** The live thread of a record, oldest first. Null when the record is not this tenant's. */
export async function listComments(c: Ctx, pageId: string): Promise<CommentView[] | null> {
    const page = await c.db.globalPage.findFirst({ where: { id: pageId }, select: { id: true } });
    if (!page) return null;
    const rows = await c.db.comment.findMany({ where: { pageId, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    const names = await userNames(c.db, rows.map(r => r.authorId));
    return rows.map(r => ({
        id: r.id, body: r.body, authorId: r.authorId, authorName: names.get(r.authorId) || '—',
        createdAt: r.createdAt.toISOString(), editedAt: r.editedAt?.toISOString() ?? null,
        resolvedAt: r.resolvedAt?.toISOString() ?? null, resolvedBy: r.resolvedBy, mine: r.authorId === c.actor.userId,
    }));
}

export async function addComment(c: Ctx, pageId: string, rawBody: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const body = cleanBody(rawBody);
    if (!body) return { ok: false, error: 'empty_or_too_long' };
    const page = await c.db.globalPage.findFirst({ where: { id: pageId }, select: { id: true, databaseId: true, properties: true } });
    if (!page) return { ok: false, error: 'not_found' };
    // Mentionable: this tenant's office users (the crew does not see comments).
    const tenantUsers = await c.db.user.findMany({ select: { id: true, role: true } });
    const mentions = mentionedIds(body, tenantUsers.filter(u => !isWorkforceRole(u.role)).map(u => u.id)).filter(id => id !== c.actor.userId);
    const row = await c.db.comment.create({ data: { tenantId: c.tenantId, pageId, authorId: c.actor.userId, body, mentions } });

    if (mentions.length) {
        const title = String((page.properties as Record<string, unknown> | null)?.title || 'Record');
        const author = (await userNames(c.db, [c.actor.userId])).get(c.actor.userId) || '';
        for (const userId of mentions) {
            await notify({
                topic: 'comments.mention',
                title: `${author} noemde je in "${title}"`,
                body: plainText(body).slice(0, 280),
                entity: { type: 'globalPage', id: pageId },
                href: `/admin/database/${page.databaseId}/${pageId}`,
                userId,
            }, { tenantId: c.tenantId, db: c.db as never }).catch(err => console.error('[comments] mention notification failed', err));
        }
    }
    return { ok: true, id: row.id };
}

async function loadOne(c: Ctx, id: string) {
    return c.db.comment.findFirst({ where: { id } });
}

/** Edit (author), delete (author or admin, soft), resolve / reopen (anyone in the office). Each change is audited. */
export async function changeComment(c: Ctx, id: string, change: { kind: 'edit'; body: unknown } | { kind: 'delete' } | { kind: 'resolve'; resolved: boolean }):
    Promise<{ ok: true } | { ok: false; error: string }> {
    const row = await loadOne(c, id);
    const refusal = commentRefusal(change.kind, row, c.actor);
    if (refusal || !row) return { ok: false, error: refusal || 'not_found' };
    const now = new Date();
    let data: Record<string, unknown>;
    if (change.kind === 'edit') {
        const body = cleanBody(change.body);
        if (!body) return { ok: false, error: 'empty_or_too_long' };
        data = { body, editedAt: now };
    } else if (change.kind === 'delete') {
        data = { deletedAt: now };
    } else {
        data = change.resolved ? { resolvedAt: now, resolvedBy: c.actor.userId } : { resolvedAt: null, resolvedBy: null };
    }
    const audit = await buildAuditLogData({ tenantId: c.tenantId, userId: c.actor.userId }, {
        entityType: 'comment', entityId: id, action: `comment-${change.kind}`, field: null,
        before: change.kind === 'edit' ? { body: row.body } : null, after: data, reason: null,
    });
    await c.db.$transaction(async tx => {
        await tx.comment.update({ where: { id }, data });
        await buildAuditLogOperation(tx, audit);
    });
    return { ok: true };
}

/** For the "Opmerkingen" field: the latest comment per record of a database (pageId → summary). */
export async function latestCommentsOf(c: Ctx, databaseId: string): Promise<Record<string, LatestComment & { authorName: string }>> {
    const rows = await c.db.comment.findMany({
        where: { page: { databaseId } },
        select: { id: true, pageId: true, authorId: true, body: true, createdAt: true, resolvedAt: true, deletedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
    });
    const byPage = new Map<string, typeof rows>();
    for (const r of rows) { const l = byPage.get(r.pageId) || []; l.push(r); byPage.set(r.pageId, l); }
    const out: Record<string, LatestComment & { authorName: string }> = {};
    const authorIds: string[] = [];
    for (const [pageId, list] of byPage) { const l = latestComment(list); if (l) { out[pageId] = { ...l, authorName: '' }; authorIds.push(l.authorId); } }
    const names = await userNames(c.db, authorIds);
    for (const k of Object.keys(out)) out[k].authorName = names.get(out[k].authorId) || '—';
    return out;
}
